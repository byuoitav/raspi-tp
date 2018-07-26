package socket

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/byuoitav/common/events"
	"github.com/byuoitav/device-monitoring-microservice/statusinfrastructure"
	"github.com/fatih/color"
	"github.com/labstack/echo"
)

type Hub struct {
	// registered clients
	clients map[*Client]bool

	// inbound messages from clients
	broadcast chan interface{}

	// 'register' requests from clients
	register chan *Client

	// 'unregister' requests from clients
	unregister chan *Client

	eventNode *events.EventNode
}

func NewHub(eventNode *events.EventNode) *Hub {
	hub := &Hub{
		broadcast:  make(chan interface{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		eventNode:  eventNode,
	}
	go hub.run()

	return hub
}

func (h *Hub) WriteToSockets(message interface{}) {
	h.broadcast <- message
}

func (h *Hub) GetStatus(context echo.Context) error {
	ret := make(map[string]interface{})

	statusInfo := make(map[string]interface{})

	version, err := statusinfrastructure.GetVersion("version.txt")
	if err != nil {
		ret["version"] = "missing"
		ret["statuscode"] = statusinfrastructure.StatusSick
		statusInfo["version-error"] = err.Error()
	} else {
		ret["version"] = version
		ret["statuscode"] = statusinfrastructure.StatusOK
		statusInfo["version-error"] = ""
	}

	statusInfo["websocket-connections"] = len(h.clients)
	var wsInfo []map[string]interface{}

	for client := range h.clients {
		info := make(map[string]interface{})
		localAddr := client.conn.LocalAddr()
		remoteAddr := client.conn.RemoteAddr()
		info["raw-connection"] = fmt.Sprintf("%s => %s", remoteAddr, localAddr)

		resolvedLocal, err := net.LookupAddr(strings.Split(localAddr.String(), ":")[0])
		if err != nil {
			info["resolve-local-error"] = err.Error()
		}

		resolvedRemote, err := net.LookupAddr(strings.Split(remoteAddr.String(), ":")[0])
		if err != nil {
			info["resolve-remote-error"] = err.Error()
		}
		info["resolved-connection"] = fmt.Sprintf("%s => %s", resolvedRemote, resolvedLocal)

		wsInfo = append(wsInfo, info)
	}

	statusInfo["websocket-info"] = wsInfo
	ret["statusinfo"] = statusInfo

	return context.JSON(http.StatusOK, ret)
}

func (h *Hub) run() {
	hostname := events.GetPiHostname()
	building := events.GetBuildingFromHostname()
	room := events.GetRoomFromHostname()

	for {
		select {
		case client := <-h.register:
			color.Set(color.FgYellow, color.Bold)
			log.Printf("New socket connection: %s", client.conn.RemoteAddr())
			color.Unset()

			remoteAddr := client.conn.RemoteAddr()

			event := events.Event{
				Hostname:         hostname,
				Timestamp:        time.Now().Format(time.RFC3339),
				LocalEnvironment: true,
				Event: events.EventInfo{
					Type:           events.DETAILSTATE,
					Requestor:      client.conn.LocalAddr().String(),
					EventCause:     events.INTERNAL,
					Device:         "touchpanel-ui-microservice",
					EventInfoKey:   "websocket",
					EventInfoValue: fmt.Sprintf("opened with %s", remoteAddr),
				},
				Building: building,
				Room:     room,
			}

			resolvedRemote, err := net.LookupAddr(strings.Split(remoteAddr.String(), ":")[0])
			if err == nil {
				event.Event.EventInfoValue = fmt.Sprintf("opened with %s", resolvedRemote)
			}
			log.Printf("sending event: %+v", event)
			h.eventNode.PublishEvent(events.Metrics, event)

			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				color.Set(color.FgYellow, color.Bold)
				log.Printf("Removing socket connection: %s", client.conn.RemoteAddr())
				color.Unset()

				remoteAddr := client.conn.RemoteAddr()

				event := events.Event{
					Hostname:         hostname,
					Timestamp:        time.Now().Format(time.RFC3339),
					LocalEnvironment: true,
					Event: events.EventInfo{
						Type:           events.DETAILSTATE,
						Requestor:      client.conn.LocalAddr().String(),
						EventCause:     events.INTERNAL,
						Device:         "touchpanel-ui-microservice",
						EventInfoKey:   "websocket",
						EventInfoValue: fmt.Sprintf("closed with %s", remoteAddr),
					},
					Building: building,
					Room:     room,
				}

				resolvedRemote, err := net.LookupAddr(strings.Split(remoteAddr.String(), ":")[0])
				if err == nil {
					event.Event.EventInfoValue = fmt.Sprintf("closed with %s", resolvedRemote)
				}
				h.eventNode.PublishEvent(events.Metrics, event)

				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}
