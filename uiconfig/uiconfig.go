package uiconfig

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"strings"

	"github.com/byuoitav/common/db"
	"github.com/byuoitav/common/structs"
	"github.com/fatih/color"
)

// UI_CONFIG_FILE is the name for the local file on the touchpanel
const UI_CONFIG_FILE = "ui-config.json"

func getUIConfig() (structs.UIConfig, error) {
	hn := os.Getenv("SYSTEM_ID")

	split := strings.Split(hn, "-")
	building := split[0]
	room := split[1]

	if len(hn) == 0 {
		logError("SYSTEM_ID is not set")
		return getUIConfigFromFile()
	}

	color.Set(color.FgYellow)
	log.Printf("Getting UI Config for %s-%s from database.", building, room)
	color.Unset()

	config, err := db.GetDB().GetUIConfig(fmt.Sprintf("%s-%s", building, room))
	if err != nil {
		logError(fmt.Sprintf("Failed to get UI Config for %s-%s from database: %v", building, room, err))
		return getUIConfigFromFile()
	}

	writeUIConfigToFile(config)

	return config, nil
}

func getUIConfigFromFile() (structs.UIConfig, error) {
	color.Set(color.FgCyan)
	log.Printf("Getting UI Config from file: %s", UI_CONFIG_FILE)
	color.Unset()

	body, err := ioutil.ReadFile(UI_CONFIG_FILE)
	if err != nil {
		logError(fmt.Sprintf("Failed to read body from file %s: %s", UI_CONFIG_FILE, err))
		return structs.UIConfig{}, err
	}

	var config structs.UIConfig
	err = json.Unmarshal(body, &config)
	if err != nil {
		logError(fmt.Sprintf("Failed to unmarshal body from file %s: %s", UI_CONFIG_FILE, err))
		return structs.UIConfig{}, err
	}

	color.Set(color.FgHiGreen, color.Bold)
	log.Printf("Returning config from file")
	color.Unset()

	return config, nil
}

func writeUIConfigToFile(config structs.UIConfig) {
	color.Set(color.FgCyan)
	log.Printf("Writing UI Config to file: %s", UI_CONFIG_FILE)
	color.Unset()

	f, err := os.Create(UI_CONFIG_FILE)
	if err != nil {
		logError(fmt.Sprintf("Failed create file %s: %s", UI_CONFIG_FILE, err))
		return
	}

	bytes, err := json.Marshal(config)
	if err != nil {
		logError(fmt.Sprintf("Failed to marshal config: %s", err))
		return
	}

	f.Write(bytes)
	f.Sync()
}

func logError(err string) {
	color.Set(color.FgRed)
	log.Printf("%s", err)
	color.Unset()
}

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const (
	letterIdxBits = 6                    // 6 bits to represent a letter index
	letterIdxMask = 1<<letterIdxBits - 1 // All 1-bits, as many as letterIdxBits
	letterIdxMax  = 63 / letterIdxBits   // # of letter indices fitting in 63 bits
)

//GenRandString .
func GenRandString(n int) string {
	b := make([]byte, n)
	// A rand.Int63() generates 63 random bits, enough for letterIdxMax letters!
	for i, cache, remain := n-1, rand.Int63(), letterIdxMax; i >= 0; {
		if remain == 0 {
			cache, remain = rand.Int63(), letterIdxMax
		}
		if idx := int(cache & letterIdxMask); idx < len(letterBytes) {
			b[i] = letterBytes[idx]
			i--
		}
		cache >>= letterIdxBits
		remain--
	}

	return string(b)
}
