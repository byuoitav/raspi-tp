import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  ComponentRef
} from "@angular/core";

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

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss", "../colorscheme.scss"]
})
export class AppComponent {
  @ViewChild(HomeComponent)
  public home: HomeComponent;
  public unlocking = false;

  public location = window.location;

  constructor(
    private api: APIService,
    public socket: SocketService,
    public command: CommandService
  ) {}

  public unlock() {
    if (this.home.wheel == null) {
      return;
    }

    this.unlocking = true;
    this.home.turnOn().subscribe(success => {
      if (!success) {
        console.log("failed to turn on");
      } else {
        setTimeout(() => (this.unlocking = false), 1000);
      }
    });
  }
}
