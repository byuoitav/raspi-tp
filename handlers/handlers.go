package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/byuoitav/central-event-system/messenger"
	"github.com/byuoitav/common/v2/events"
	"github.com/byuoitav/touchpanel-ui-microservice/helpers"
	"github.com/labstack/echo"
)

func GetHostname(context echo.Context) error {
	hostname, err := os.Hostname()
	if err != nil {
		return context.JSON(http.StatusInternalServerError, err.Error())
	}

	return context.JSON(http.StatusOK, hostname)
}

func GetPiHostname(context echo.Context) error {
	hostname := os.Getenv("SYSTEM_ID")
	return context.JSON(http.StatusOK, hostname)
}

func GetDeviceInfo(context echo.Context) error {
	di, err := helpers.GetDeviceInfo()
	if err != nil {
		return context.JSON(http.StatusBadRequest, err.Error())
	}

	return context.JSON(http.StatusOK, di)
}

func Reboot(context echo.Context) error {
	log.Printf("[management] Rebooting pi")
	http.Get("http://localhost:7010/reboot")
	return nil
}

func GetDockerStatus(context echo.Context) error {
	log.Printf("[management] Getting docker status")
	resp, err := http.Get("http://localhost:7010/dockerStatus")
	log.Printf("docker status response: %v", resp)
	if err != nil {
		return context.JSON(http.StatusBadRequest, err.Error())
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return context.JSON(http.StatusBadRequest, err.Error())
	}

	return context.String(http.StatusOK, string(body))
}

// GenerateHelpFunction generates an echo handler that handles help requests.
func GenerateHelpFunction(value string, messenger *messenger.Messenger) func(ctx echo.Context) error {
	return func(ctx echo.Context) error {
		deviceInfo := events.GenerateBasicDeviceInfo(os.Getenv("SYSTEM_ID"))

		// send an event requesting help
		event := events.Event{
			GeneratingSystem: deviceInfo.DeviceID,
			Timestamp:        time.Now(),
			EventTags: []string{
				events.Alert,
			},
			TargetDevice: deviceInfo,
			AffectedRoom: events.GenerateBasicRoomInfo(deviceInfo.RoomID),
			Key:          "help-request",
			Value:        value,
			User:         ctx.RealIP(),
			Data:         nil,
		}

		log.Printf("Sending event to %s help. (event: %+v)", value, event)
		messenger.SendEvent(event)

		return ctx.String(http.StatusOK, fmt.Sprintf("Help has been %sed", value))
	}
}

func Help(context echo.Context) error {
	log.Printf("Starting to help")

	//Authorization
	token := "Bearer " + os.Getenv("SLACK_TOKEN_HELP")
	//The request we are sent comes with a trigger id which we need to send back
	context.Request().ParseForm()
	triggerID := context.Request().Form["trigger_id"][0]

	//How to Open a Slack Dialog
	url := "https://slack.com/api/dialog.open"

	// build json payload
	// Overarching Structure
	var ud helpers.UserDialog
	// dialog
	var dialog helpers.Dialog
	dialog.Title = "Gondor calls for aid!"
	// elements
	var elemOne helpers.Element
	var elemTwo helpers.Element
	elemOne.Name = "roomID"
	elemOne.Label = "Room"
	elemOne.Type = "text"
	elemTwo.Name = "notes"
	elemTwo.Label = "Notes"
	elemTwo.Type = "textarea"

	dialog.Elements = append(dialog.Elements, elemOne)
	dialog.Elements = append(dialog.Elements, elemTwo)

	//TODO Change this to an identifier for the issue
	dialog.CallbackID = "helpme"

	//Throw it together
	ud.Dialog = dialog
	ud.TriggerID = triggerID

	//Marshal it
	json, err := json.Marshal(ud)
	if err != nil {
		log.Printf("failed to marshal dialog: %v", ud)
		return context.JSON(http.StatusInternalServerError, err.Error())
	}

	//Make the request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(json))
	req.Header.Set("Content-type", "application/json; charset=utf-8") //Note the charset. If you don't have it they will yell at you
	req.Header.Set("Authorization", token)

	//We don't really care about this response because it has no nutrients! (useful information)
	client := &http.Client{}
	_, err = client.Do(req)
	if err != nil {
		panic(err)
	}
	return context.String(http.StatusOK, "")
}

//Handles repsonses from Slack, sending the requests to the proper functions
func HandleSlack(context echo.Context) error {
	log.Printf("Handling Slack response")
	//Necessary to read the request body
	context.Request().ParseForm()
	//Finds the callback id
	payload := context.Request().Form["payload"][0]
	r := regexp.MustCompile("\"callback_id\":\"(.*?)\"")
	callback := r.FindStringSubmatch(payload)

	if callback[1] == "helpme" {
		err := HandleDialog(context)
		if err != nil {
			log.Printf("Couldn't handle dialog: %v")
			return context.JSON(http.StatusInternalServerError, err.Error())
		}
	} else if callback[1] == "help_request" {
		err := HandleRequest(context)
		if err != nil {
			log.Printf("Couldn't handle the help request: %v")
			return context.JSON(http.StatusInternalServerError, err.Error())
		}
	}
	return context.String(http.StatusOK, "")

}

func HandleRequest(context echo.Context) error {
	payload := context.Request().Form["payload"][0]

	r := regexp.MustCompile("\"value\":\"(.*?)\"")
	actionValue := r.FindStringSubmatch(payload)[1]
	switch actionValue {
	case "techsent":
		r = regexp.MustCompile(`"user":{.*?name":"(.*?)"`)
		techName := r.FindStringSubmatch(payload)[1]
		//r = regexp.MustCompile("\"action_ts\":\"(.*?)\"")
		//timeStamp := r.FindStringSubmatch(payload)[1]
		r = regexp.MustCompile(`Room","value":"(.*?)"`)
		roomID := r.FindStringSubmatch(payload)[1]
		//TODO Add this to the display
		//r = regexp.MustCompile("\"notes\":\"(.*?)\"")
		//notes := r.FindStringSubmatch(payload)[1]

		log.Printf("We sent a tech: %v at %v\n\n", techName, time.Now())

		e := events.Event{
			GeneratingSystem: roomID,
			Timestamp:        time.Now(),
			AffectedRoom:     events.GenerateBasicRoomInfo(roomID),
			//TargetDevice:     events.GenerateBasicDeviceInfo("ITB-1101-CP3"), //This one is dumb and isn't real
			//Key:              "Key?",                                         //Same
			//Value:            "Value?",                                       //Same
			User:      "Caleb", //Same
			EventTags: []string{events.HelpRequest},
			//Data:      notes,
		}
		json, err := json.Marshal(e)
		if err != nil {
			log.Printf("failed to marshal sh: %v", e)
			return err
		}
		url := "http://10.5.34.47:2323/hitelk"
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(json))
		if err != nil {
			log.Printf("Couldn't make the request: %v", err)
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		_, err = client.Do(req)
		if err != nil {
			panic(err)
		}

	case "techarrived":
		log.Printf("The tech arrived!")
	case "resolved":
		log.Printf("We resolved the thing!")
	default:
		log.Printf("For some reason, one of the three possible answers didn't work. That's a problem")
	}

	return context.String(http.StatusOK, "")
}

func HandleDialog(context echo.Context) error {
	//Find the payload amid the context
	payload := context.Request().Form["payload"][0]
	//The mess you see below is a regex that we pray doesn't ever break.
	//If all works correctly, it should pull out the values you need without having to ever look at it again
	//Hopefully this gets out the room that needs help and the notes for that room
	r1 := regexp.MustCompile("\"roomID\":\"(.*?)\"")
	r2 := regexp.MustCompile("\"notes\":\"(.*?)\"")
	roomID := r1.FindStringSubmatch(payload)[1]
	notes := r2.FindStringSubmatch(payload)[1]
	log.Printf("[Follow Up] Trying to find stuff: %v ---------- %v", roomID, notes)
	var sh helpers.SlackHelp
	sh.Building = strings.Split(roomID, "-")[0]
	sh.Room = roomID
	err := CreateAlert(sh)
	if err != nil {
		log.Printf("Could not create Help Request: %v", err.Error())
		return context.JSON(http.StatusInternalServerError, err.Error())
	}

	return context.String(http.StatusOK, "")
}

func CreateAlert(sh helpers.SlackHelp) error {
	/*var sh helpers.SlackHelp
	err := context.Bind(&sh)
	if err != nil {
		return context.JSON(http.StatusBadRequest, err.Error())
	}
	*/
	log.Printf("Requesting help in building %s, room %s", sh.Building, sh.Room)
	url := os.Getenv("SLACK_NEW_HELP_WEBHOOK")
	if len(url) == 0 {
		panic(fmt.Sprintf("SLACK_NEW_HELP_WEBHOOK is not set."))
	}

	// build json payload
	// attachment
	var attachment helpers.Attachment
	//attachment.Title = "Help Request"
	attachment.CallbackID = "help_request"
	// fields
	var fieldOne helpers.Field
	var fieldTwo helpers.Field
	fieldOne.Title = "Building"
	fieldOne.Value = sh.Building
	fieldOne.Short = true
	fieldTwo.Title = "Room"
	fieldTwo.Value = sh.Room
	fieldTwo.Short = true
	//TODO Add ability to tell which device is acting up

	// actions
	var actionOne helpers.Action
	var actionTwo helpers.Action
	var actionThree helpers.Action
	actionOne.Name = "techsent"
	actionOne.Text = "Technician Sent"
	actionOne.Type = "button"
	actionOne.Value = "techsent"

	actionTwo.Name = "techarrived"
	actionTwo.Text = "Technician Arrived"
	actionTwo.Type = "button"
	actionTwo.Value = "techarrived"

	actionThree.Name = "resolved"
	actionThree.Text = "Resolved"
	actionThree.Type = "button"
	actionThree.Value = "resolved"

	// put into sh
	attachment.Fields = append(attachment.Fields, fieldOne)
	attachment.Fields = append(attachment.Fields, fieldTwo)
	attachment.Actions = append(attachment.Actions, actionOne)
	attachment.Actions = append(attachment.Actions, actionTwo)
	attachment.Actions = append(attachment.Actions, actionThree)

	sh.Attachments = append(sh.Attachments, attachment)

	json, err := json.Marshal(sh)
	if err != nil {
		log.Printf("failed to marshal sh: %v", sh)
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(json))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	_, err = client.Do(req)
	if err != nil {
		panic(err)
	}

	return nil
}
