package uiconfig

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/byuoitav/common/status"
	"github.com/labstack/echo"
)

type APIHost struct {
	Hostname string `json:"hostname"`
}

var apiNum = 0
var version = "0"

func init() {
	version, _ = status.GetMicroserviceVersion()
}

func GetAPI(context echo.Context) error {
	config, err := getUIConfig()
	if err != nil {
		return context.JSON(http.StatusInternalServerError, err.Error())
	}

	if len(config.Api) <= apiNum {
		apiNum = 0
	}

	return context.JSON(http.StatusOK, &APIHost{Hostname: config.Api[apiNum]})
}

func NextAPI(context echo.Context) error {
	apiNum++

	return GetAPI(context)
}

func GetUIConfig(context echo.Context) error {
	j, err := getUIConfig()
	if err != nil {
		return context.JSON(http.StatusInternalServerError, err.Error())
	}

	return context.JSON(http.StatusOK, j)
}

func GetUIPath(context echo.Context) error {
	config, err := getUIConfig()
	if err != nil {
		return context.JSON(http.StatusInternalServerError, err.Error())
	}

	hostname := os.Getenv("SYSTEM_ID")
	for _, panel := range config.Panels {
		if strings.EqualFold(hostname, panel.Hostname) {
			//we also want to generate a query parameter to add to the end each time it refreshes.
			str := GenRandString(8)
			queryString := fmt.Sprintf("?%s=%s", url.QueryEscape(version), url.QueryEscape(str))

			return context.JSON(http.StatusOK, &APIHost{Hostname: panel.UIPath + queryString})
		}
	}

	return context.JSON(http.StatusInternalServerError, &APIHost{Hostname: "/404.html"})
}
