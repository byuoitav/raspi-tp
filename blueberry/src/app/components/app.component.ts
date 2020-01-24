import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  ComponentRef
} from "@angular/core";
import { MatDialog } from "@angular/material";

import { APIService } from "../services/api.service";
import { DataService } from "../services/data.service";
import { CommandService } from "../services/command.service";
import { SocketService } from "../services/socket.service";
import { Preset, Panel } from "../objects/objects";
import {
  Device,
  Input,
  Output,
  Display,
  AudioDevice,
  POWER,
  INPUT,
  BLANKED,
  MUTED,
  VOLUME
} from "../objects/status.objects";
import { HomeComponent } from "./home.component";
import { AudioComponent } from "./audio/audio.component";
import { ErrorService, PowerOn } from "app/services/error.service";
import { MobileControlModal } from "../modals/mobilecontrolmodal/mobilecontrolmodal.component";
import { ProjectorComponent } from "./projector/projector.component";


@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss", "../colorscheme.scss"]
})
export class AppComponent {
  @ViewChild(HomeComponent)
  public home: HomeComponent;
  public unlocking = false;
  public controlKey: string;
  public roomControlUrl: string;
  public location = window.location;

  @ViewChild(AudioComponent)
  public audio: AudioComponent;

  @ViewChild(ProjectorComponent)
  public screen: ProjectorComponent

  constructor(
    private api: APIService,
    public socket: SocketService,
    public command: CommandService,
    private dialog: MatDialog,
    private es: ErrorService,
    private data: DataService,
  ) {
    this.data.loaded.subscribe(() => {
      this.getCode();
      setInterval( () => {
        this.getCode();
      }, 300000);
    });
  }

  public unlock() {
    if (this.home.wheel == null) {
      return;
    }

    this.unlocking = true;
    this.home.turnOn().subscribe(success => {
      if (!success) {
        console.log("failed to turn on");
        this.es.show(PowerOn, "");
        this.unlocking = false;
      } else {
        setTimeout(() => (this.unlocking = false), 1000);
      }
    });
  }

  public getCode() {
    const preset = this.data.panel.preset.name;
    this.api.getControlKey(preset).subscribe(data => {
      this.controlKey = data["controlKey"];
      this.roomControlUrl = data["url"];
    }, err => {
      console.warn("Unable to get Control Key: " + err);
    });

  }

  showManagement = (): boolean => {
    if (this.dialog.openDialogs.length > 0) {
      return false;
    }

    if (this.home.audio && this.home.audio.isShowing()) {
      return false;
    }

    if (this.audio.isShowing()) {
      return false;
    }

    if (this.screen.isShowing()) {
      return false;
    }

    if (!this.home) {
      return true;
    }

    if (!this.home.wheel) {
      return true;
    }

    if (this.home.wheel.getPower() === "standby") {
      return true;
    }

    return false;
  };

  public showMobileControl() {
    console.log("this is audio: ", this.data);
    const ref = this.dialog.open(MobileControlModal, {
      width: "70vw",
      height: "52.5vw"
    });
  }
}
