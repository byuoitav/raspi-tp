import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";
import { CommandService } from 'app/services/command.service';
import { Preset, DeviceConfiguration } from 'app/objects/objects';


@Component({
  selector: 'lock-screen-screen-control',
  templateUrl: './lockscreenscreencontrol.component.html',
  styleUrls: ['./lockscreenscreencontrol.component.scss']
})
export class LockScreenScreenControlComponent implements OnInit {
  preset: Preset;
  _show: boolean;
  devices: DeviceConfiguration[] = [];

  pages: number[] = [];
  curPage: number;

  constructor(
    private command: CommandService,
  ) { this._show = false }

  ngOnInit() {
  }

  show = (preset: Preset) => {
    this.preset = preset;
    this.devices.length = 0;

    for (const s of preset.screens) {
      this.devices.push(s);
    }

    const pages = Math.ceil(this.devices.length / 4);
    this.pages = new Array(pages).fill(undefined).map((x, i) => i);

    console.log("devices:", this.devices.length, "pages:", this.pages);
    this.curPage = 0;

    this._show = true;
  }

  hide = () => {
    this.command.buttonPress("close projector modal");
    this._show = false;
  }

  isShowing = (): boolean => {
    return this._show;
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
    this.command.projectorUp(screen).subscribe(success => {
      if (success) {

      } else {
        console.warn("failed to move the screen up");
      }
    });
  }

  projectorDown(screen: DeviceConfiguration) {
    this.command.projectorDown(screen).subscribe(success => {
      if (success) {

      } else {
        console.warn("failed to move the screen down");
      }
    });
  }

  projectorStop(screen: DeviceConfiguration) {
    this.command.projectorStop(screen).subscribe(success => {
      if (success) {

      } else {
        console.warn("failed to stop the screen");
      }
    });
  }
}

