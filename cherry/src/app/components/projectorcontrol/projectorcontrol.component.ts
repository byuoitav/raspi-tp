import { Component, OnInit } from "@angular/core";
import { MatTabGroup } from "@angular/material/tabs";
import { Preset, DeviceConfiguration } from "../../objects/objects";
import {
  Input,
  ViewChild,
} from "@angular/core";
import { CommandService } from "../../services/command.service";

@Component({
  selector: "projector-control",
  templateUrl: "./projectorcontrol.component.html",
  styleUrls: ["./projectorcontrol.component.scss"]
})
export class ProjectorControlComponent implements OnInit {
  @Input() preset: Preset;
  devices: DeviceConfiguration[] = [];

  pages: number[] = [];
  curPage: number;

  constructor(public command: CommandService) { }

  ngOnInit() {
    this.devices.length = 0;

    for (const s of this.preset.screens) {
      this.devices.push(s);
    }

    const pages = Math.ceil(this.devices.length / 4);
    this.pages = new Array(pages).fill(undefined).map((x, i) => i);

    console.log("devices:", this.devices.length, "pages:", this.pages);
    this.curPage = 0;
  }

  pageLeft = () => {
    if (this.canPageLeft()) {
      this.curPage--;
    }

    // scroll to the bottom of the page
    const idx = 3 * this.curPage;
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
    const idx = 4 * this.curPage + 3;
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

  projectorUp(screen: DeviceConfiguration) {
    this.command.projectorUp(screen.address).subscribe(success => {
      if (success) {

      } else {
        console.warn("failed to move the screen up");
      }
    });
  }

  projectorDown(screen: DeviceConfiguration) {
    this.command.projectorDown(screen.address).subscribe(success => {
      if (success) {

      } else {
        console.warn("failed to move the screen down");
      }
    });
  }

  projectorStop(screen: DeviceConfiguration) {
    this.command.projectorStop(screen.address).subscribe(success => {
      if (success) {

      } else {
        console.warn("failed to stop the screen");
      }
    });
  }

}
