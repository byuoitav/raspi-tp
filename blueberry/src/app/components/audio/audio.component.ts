import { Component, OnInit, Input } from "@angular/core";

import { CommandService } from "../../services/command.service";
import { AudioDevice } from "../../objects/status.objects";
import { Preset } from "../../objects/objects";

@Component({
  selector: "audiocontrol",
  templateUrl: "./audio.component.html",
  styleUrls: ["./audio.component.scss"]
})
export class AudioComponent implements OnInit {
  preset: Preset;
  devices: AudioDevice[] = [];

  pages: number[] = [];
  curPage: number;

  _show: boolean;

  constructor(private command: CommandService) {
    this._show = false;
  }

  ngOnInit() {}

  show = (preset: Preset) => {
    this.preset = preset;
    this.devices.length = 0; // reset devices

    for (const a of preset.independentAudioDevices) {
      this.devices.push(a);
    }

    const pages = Math.ceil(this.devices.length / 4);
    this.pages = new Array(pages).fill(undefined).map((x, i) => i);

    console.log("devices:", this.devices.length, "pages:", this.pages);
    this.curPage = 0;

    this._show = true;
  };

  hide = () => {
    this.command.buttonPress("close audio modal");
    this._show = false;
  };

  isShowing = () => {
    return this._show;
  };

  getDisplayVolume = (): number => {
    return AudioDevice.getVolume(this.preset.audioDevices);
  };

  getDisplayMute = (): boolean => {
    return AudioDevice.getMute(this.preset.audioDevices);
  };

  pageLeft = () => {
    if (this.canPageLeft()) {
      this.curPage--;
    }

    // scroll to the bottom of the page
    const idx = 4 * this.curPage;
    console.log(document.querySelector("#device" + idx));
    document.querySelector("#device" + idx).scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start"
    });
  };

  pageRight = () => {
    if (this.canPageRight()) {
      this.curPage++;
    }

    // scroll to the top of the page
    const idx = 4 * this.curPage;
    console.log(document.querySelector("#device" + idx));
    document.querySelector("#device" + idx).scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start"
    });
  };

  canPageLeft = (): boolean => {
    if (this.curPage <= 0) {
      return false;
    }

    return true;
  };

  canPageRight = (): boolean => {
    if (this.curPage + 1 >= this.pages.length) {
      return false;
    }

    return true;
  };

  getInputName = (): string => {
    if (!this.preset) {
      return "Display Volume";
    }

    if (!this.preset.displays || this.preset.displays.length === 0) {
      return "Display Volume";
    }

    if (!this.preset.displays[0].input || !this.preset.displays[0].input.name) {
      return "Display Volume";
    }

    return "Display Volume (" + this.preset.displays[0].input.displayname + ")";
  };
}
