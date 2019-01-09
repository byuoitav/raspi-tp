package helpers

import (
	"log"
	"os/exec"
	"strings"
)

type DeviceInfo struct {
	Hostname  string `json:"hostname"`
	IPAddress string `json:"ipaddress"`
}

type SlackInfo struct {
	Token     string `x-www-form-urlencoded:"token"`
	Username  string `x-www-form-urlencoded:"user_name"`
	TriggerID string `x-www-form-urlencoded:"trigger_id"`
}

type SlackHelp struct {
	Building    string       `json:"building"`
	Room        string       `json:"room"`
	Attachments []Attachment `json:"attachments"`
	Text        string       `json:"text"`
}

type SlackMessage struct {
	Text string `json:"text"`
}

type Attachment struct {
	Title      string   `json:"title"`
	Fields     []Field  `json:"fields"`
	Actions    []Action `json:"actions"`
	CallbackID string   `json:"callback_id"`
	Fallback   string   `json:"fallback"`
}

type Field struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Short bool   `json:"short"`
}

type Action struct {
	Name  string `json:"name"`
	Text  string `json:"text"`
	Type  string `json:"type"`
	Value string `json:"value"`
}

type UserDialog struct {
	TriggerID string `json:"trigger_id"`
	Dialog    Dialog `json:"dialog"`
}

type Dialog struct {
	TriggerID   string    `json:"trigger_id"`
	Title       string    `json:"title"`
	SubmitLabel string    `json:"submit_label"`
	Elements    []Element `json:"elements"`
	CallbackID  string    `json:"callback_id"`
}

type Element struct {
	Type  string `json:"type"`
	Label string `json:"label"`
	Name  string `json:"name"`
}

type HelpRequest struct {
	Building string `json:"building"`
	Room     string `json:"room"`
	Device   string `json:"device"`
	Notes    string `json:"notes"`
}

func GetDeviceInfo() (DeviceInfo, error) {
	log.Printf("getting device info")
	hn, err := exec.Command("sh", "-c", "hostname").Output()
	if err != nil {
		return DeviceInfo{}, err
	}

	ip, err := exec.Command("/bin/bash", "-c", "ip addr show | grep -m 1 global | awk '{print $2}'").Output()
	if err != nil {
		return DeviceInfo{}, err
	}

	var di DeviceInfo
	di.Hostname = strings.TrimSpace(string(hn[:]))
	di.IPAddress = strings.TrimSpace(string(ip[:]))

	return di, nil
}
