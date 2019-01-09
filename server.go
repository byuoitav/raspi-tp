package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/byuoitav/central-event-system/hub/base"
	"github.com/byuoitav/central-event-system/messenger"
	"github.com/byuoitav/common"
	"github.com/byuoitav/common/db"
	"github.com/byuoitav/common/log"
	commonEvents "github.com/byuoitav/common/v2/events"
	"github.com/byuoitav/touchpanel-ui-microservice/events"
	"github.com/byuoitav/touchpanel-ui-microservice/handlers"
	"github.com/byuoitav/touchpanel-ui-microservice/socket"
	"github.com/byuoitav/touchpanel-ui-microservice/uiconfig"
	"github.com/labstack/echo"
)

func main() {
	deviceInfo := commonEvents.GenerateBasicDeviceInfo(os.Getenv("SYSTEM_ID"))
	messenger, err := messenger.BuildMessenger(os.Getenv("HUB_ADDRESS"), base.Messenger, 1000)
	if err != nil {
		log.L.Errorf("unable to build the messenger: %s", err.Error())
	}

	messenger.SubscribeToRooms(deviceInfo.RoomID)
	socket.SetMessenger(messenger)

	// websocket hub
	go events.WriteEventsToSocket(messenger)
	go events.SendRefresh(time.NewTimer(time.Second * 10))

	port := ":8888"
	router := common.NewRouter()

	router.GET("/status", func(ctx echo.Context) error {
		return socket.GetStatus(ctx)
	})

	// event endpoints
	router.POST("/publish", func(ctx echo.Context) error {
		var event commonEvents.Event
		gerr := ctx.Bind(&event)
		if gerr != nil {
			return ctx.String(http.StatusBadRequest, gerr.Error())
		}

		// TODO verify that I am correct in assuming that events are always routed to each messenger in the room (to the other UI's)
		messenger.SendEvent(event)

		log.L.Debugf("sent event from UI: %+v", event)
		return ctx.String(http.StatusOK, "success")
	})

	// websocket
	router.GET("/websocket", func(context echo.Context) error {
		socket.ServeWebsocket(context.Response().Writer, context.Request())
		return nil
	})

	// socket endpoints
	router.PUT("/screenoff", func(context echo.Context) error {
		events.SendScreenTimeout()
		return nil
	})
	router.PUT("/refresh", func(context echo.Context) error {
		events.SendRefresh(time.NewTimer(0))
		return nil
	})
	router.PUT("/socketTest", func(context echo.Context) error {
		events.SendTest()
		return context.JSON(http.StatusOK, "sent")
	})

	router.GET("/pihostname", handlers.GetPiHostname)
	router.GET("/hostname", handlers.GetHostname)
	router.GET("/deviceinfo", handlers.GetDeviceInfo)
	router.GET("/reboot", handlers.Reboot)
	router.GET("/dockerstatus", handlers.GetDockerStatus)

	router.GET("/uiconfig", uiconfig.GetUIConfig)
	router.GET("/uipath", uiconfig.GetUIPath)
	router.GET("/api", uiconfig.GetAPI)
	router.GET("/nextapi", uiconfig.NextAPI)

	router.POST("/help", handlers.GenerateHelpFunction("request", messenger))
	router.POST("/slackhelp", handlers.Help)
	router.POST("/handleslack", handlers.HandleSlack)
	router.POST("/confirmhelp", handlers.GenerateHelpFunction("confirm", messenger))
	router.POST("/cancelhelp", handlers.GenerateHelpFunction("cancel", messenger))

	// all the different ui's
	router.Static("/", "redirect.html")
	router.Any("/404", redirect)
	router.Static("/blueberry", "blueberry-dist")
	router.Static("/cherry", "cherry-dist")

	router.GET("/blueberry/db/:attachment", getCouchAttachment("blueberry"))
	router.GET("/cherry/db/:attachment", getCouchAttachment("cherry"))

	router.Start(port)
}

func redirect(context echo.Context) error {
	http.Redirect(context.Response().Writer, context.Request(), "http://github.com/404", 302)
	return nil
}

func getCouchAttachment(ui string) func(ctx echo.Context) error {
	return func(ctx echo.Context) error {
		attachment := ctx.Param("attachment")
		log.L.Debugf("Getting attachment %s for %s ui.", attachment, ui)

		typeString, bytes, err := db.GetDB().GetUIAttachment(ui, attachment)
		if err != nil {
			return ctx.String(http.StatusInternalServerError, fmt.Sprintf("failed to get %s: %v", ctx.Param("attachment"), err))
		}

		return ctx.Blob(http.StatusOK, typeString, bytes)
	}
}
