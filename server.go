package main

import (
	"net/http"
	"os"
	"time"

	"github.com/byuoitav/central-event-system/hub/base"
	"github.com/byuoitav/central-event-system/messenger"
	"github.com/byuoitav/common"
	"github.com/byuoitav/common/log"
	commonEvents "github.com/byuoitav/common/v2/events"
	"github.com/byuoitav/touchpanel-ui-microservice/events"
	"github.com/byuoitav/touchpanel-ui-microservice/handlers"
	"github.com/byuoitav/touchpanel-ui-microservice/socket"
	"github.com/byuoitav/touchpanel-ui-microservice/uiconfig"
	"github.com/labstack/echo"
)

func main() {
	log.L.Infof("here")
	deviceInfo := commonEvents.GenerateBasicDeviceInfo(os.Getenv("SYSTEM_ID"))
	messenger, err := messenger.BuildMessenger(os.Getenv("HUB_ADDRESS"), base.Messenger, 1000)
	if err != nil {
		log.L.Errorf("unable to build the messenger: %s", err.Error())
	}

	messenger.SubscribeToRooms([]string{deviceInfo.RoomID})
	socket.SetMessenger(messenger)

	// websocket hub
	go events.WriteEventsToSocket(messenger)
	go events.SendRefresh(time.NewTimer(time.Second * 10))

	port := ":8888"
	router := common.NewRouter()

	router.GET("/status", func(ctx echo.Context) error {
		return socket.GetStatus(ctx)
	})

	// TODO note that I am removing the publish feature endpoint.
	// event endpoints
	router.POST("/publish", func(ctx echo.Context) error {
		var event commonEvents.Event
		gerr := ctx.Bind(&event)
		if gerr != nil {
			return ctx.String(http.StatusBadRequest, gerr.Error())
		}

		// TODO verify that I am correct in assuming that events are always routed to each messenger in the room (to the other UI's)
		messenger.SendEvent(event)
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

	router.POST("/help", handlers.Help)
	router.POST("/confirmhelp", handlers.ConfirmHelp)
	router.POST("/cancelhelp", handlers.CancelHelp)

	// all the different ui's
	router.Static("/", "redirect.html")
	router.Any("/404", redirect)
	router.Static("/blueberry", "blueberry-dist")
	router.Static("/cherry", "cherry-dist")

	router.Start(port)
}

func redirect(context echo.Context) error {
	http.Redirect(context.Response().Writer, context.Request(), "http://github.com/404", 302)
	return nil
}
