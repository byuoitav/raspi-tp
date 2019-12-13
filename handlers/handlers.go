package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
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

func GetControlKey(c echo.Context) error {
	preset := c.Param("preset")

	ctx, cancel := context.WithTimeout(c.Request().Context(), 8*time.Second)
	defer cancel()

	key, err := helpers.GetControlKey(ctx, preset)
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}
	resp := make(map[string]string)
	resp["controlKey"] = key
	resp["url"] = os.Getenv("ROOM_CONTROL_URL")

	return c.JSON(http.StatusOK, resp)
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
	req, _ := http.NewRequest(http.MethodPut, "http://localhost:10000/device/reboot", nil)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return context.String(http.StatusInternalServerError, err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode/100 == 2 {
		return context.String(http.StatusOK, "rebooting")
	}

	return context.String(http.StatusInternalServerError, "unable to reboot")
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
