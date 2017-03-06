package main

import (
	"html/template"
	"net/http"

	"github.com/byuoitav/touchpanel-ui-microservice/helpers"
	"github.com/byuoitav/touchpanel-ui-microservice/views"
	"github.com/jessemillar/health"
	"github.com/labstack/echo"
	"github.com/labstack/echo/middleware"
)

func main() {
	port := ":8888"
	router := echo.New()
	router.Pre(middleware.RemoveTrailingSlash())
	router.Use(middleware.CORS())

	templateEngine := &helpers.Template{
		Templates: template.Must(template.ParseGlob("public/*/*.html")),
	}

	router.Renderer = templateEngine

	router.GET("/health", echo.WrapHandler(http.HandlerFunc(health.Check)))

	// Views
	router.Static("/*", "public")
	router.GET("/", views.Main)

	router.Start(port)
}
