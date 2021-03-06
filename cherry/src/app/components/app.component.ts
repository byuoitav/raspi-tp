import { Component, ViewEncapsulation, ViewChild } from "@angular/core";
import { MatTabChangeEvent, MatDialog, MatDialogRef } from "@angular/material";
import { trigger, style, animate, transition } from "@angular/animations";
import { Http } from "@angular/http";
import { DataService } from "../services/data.service";
import { CommandService } from "../services/command.service";
import { GraphService } from "../services/graph.service";
import { HelpDialog } from "../dialogs/help.dialog";
import { Output } from "../objects/status.objects";
import { APIService } from "../services/api.service";
import { Event, BasicRoomInfo } from "../services/socket.service";
import { MobileControlComponent } from "./mobilecontrol/mobilecontrol.component";
import { AudiocontrolComponent } from "./audiocontrol/audiocontrol.component";
import { ProjectorControlComponent } from "./projectorcontrol/projectorcontrol.component";
import { MatDialogModule } from '@angular/material';
import { LockScreenAudioComponent } from "./lockscreenaudio/lockscreenaudio.component";
import { LockScreenScreenControlComponent } from "./lockscreenscreencontrol/lockscreenscreencontrol.component";


const HIDDEN = "hidden";
const QUERY = "query";
const LOADING = "indeterminate";
const BUFFER = "buffer";

@Component({
  selector: "cherry",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  encapsulation: ViewEncapsulation.None,
  animations: [
    trigger("delay", [
      transition(":enter", [animate(500)]),
      transition(":leave", [animate(500)])
    ])
  ]
})
export class AppComponent {
  public loaded: boolean;
  public unlocking = false;
  public progressMode: string = QUERY;
  public mobileRef: MatDialogRef<MobileControlComponent>;

  public selectedTabIndex: number;

  @ViewChild(LockScreenAudioComponent)
  public lockaudio: LockScreenAudioComponent;

  @ViewChild(LockScreenScreenControlComponent)
  public screen: LockScreenScreenControlComponent;

  constructor(
    public data: DataService,
    public command: CommandService,
    public dialog: MatDialog,
    private api: APIService,
    private http: Http
  ) {
    this.loaded = false;
    this.data.loaded.subscribe(() => {
      this.loaded = true;
    });
  }

  public showManagement(): boolean {
    if (this.screen.isShowing() || this.lockaudio.isShowing()) {
      return false;
    }

    if (this.isPoweredOff()) {
      return true;
    }
    return false;
  }

  public isPoweredOff(): boolean {
    return !Output.isPoweredOn(this.data.panel.preset.displays);
  }

  public unlock() {
    this.unlocking = true;
    this.progressMode = QUERY;
    if (this.mobileRef != null) {
      this.dialog.closeAll();
    }

    this.command.powerOnDefault(this.data.panel.preset).subscribe(success => {
      if (!success) {
        this.reset();
        console.warn("failed to turn on");
        // const event = new Event();

        //   event.User = APIService.piHostname;
        //   event.EventTags = ["user-error"];
        //   event.AffectedRoom = new BasicRoomInfo(
        //     APIService.piHostname
        // );
        // event.Key = "user-error";
        // event.Value = "failed to turn on";

        // this.api.sendEvent(event);
        // this.dialog.open(ErrorDialog, { data: "Failed to do the power on default."});
      } else {
        // switch direction of loading bar
        this.progressMode = LOADING;

        this.reset();
      }
    });
  }

  public powerOff() {
    this.progressMode = QUERY;

    this.command.powerOff(this.data.panel.preset).subscribe(success => {
      if (!success) {
        console.warn("failed to turn off");
      } else {
        this.reset();
      }
    });
  }

  private reset() {
    // select displays tab
    this.selectedTabIndex = 0;

    // reset mix levels to 100
    this.data.panel.preset.audioDevices.forEach(a => (a.mixlevel = 100));

    // reset masterVolume level
    this.data.panel.preset.masterVolume = 30;

    // reset masterMute
    this.data.panel.preset.masterMute = false;

    // stop showing progress bar
    this.unlocking = false;
  }

  public openHelpDialog() {
    const dialogRef = this.dialog.open(HelpDialog, {
      width: "70vw",
      disableClose: true
    });
  }

  public openMobileControlDialog() {
    this.mobileRef = this.dialog.open(MobileControlComponent, {
      width: "70vw",
      height: "52.5vw"
    });
  }
}
