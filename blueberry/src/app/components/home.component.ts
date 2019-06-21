import {
  Component,
  ViewChild,
  EventEmitter,
  Output as AngularOutput,
  OnInit
} from "@angular/core";
import { MatDialog } from "@angular/material";
import { deserialize } from "serializer.ts/Serializer";
import swal, { SweetAlertOptions } from "sweetalert2";
import { SwalComponent, SwalPartialTargets } from "@toverux/ngx-sweetalert2";
import { WheelComponent } from "./wheel.component";
import { DataService } from "../services/data.service";
import { CommandService } from "../services/command.service";
import { APIService } from "../services/api.service";
import { GraphService } from "../services/graph.service";
import {
  SocketService,
  MESSAGE,
  Event,
  BasicDeviceInfo,
  BasicRoomInfo
} from "../services/socket.service";
import { Preset, AudioConfig } from "../objects/objects";
import {
  Output,
  Display,
  AudioDevice,
  INPUT,
  Input,
  POWER,
  POWER_OFF_ALL
} from "../objects/status.objects";
import { HelpInfo } from "../objects/modals";
import { HelpModal } from "../modals/helpmodal/helpmodal.component";
import { PowerOffAllModalComponent } from "../modals/poweroffallmodal/poweroffallmodal.component";
import { ShareModalComponent } from "../modals/sharemodal/sharemodal.component";
import { AudioModalComponent } from "../modals/audiomodal/audiomodal.component";
import { Action } from "./activity-button/activity-button.component";

export const SHARE = "start_share";
export const STOP_SHARE = "stop_share";
export const LEAVE_SHARE = "leave_share";
export const JOIN_SHARE = "join_share";

/*
 * This is where the logic for sharing lives.
 *
 * To start sharing, send an event:
 *      {
 *          requestor: the name of the preset that is sharing,
 *          device: list of displays you are sharing to,
 *          Key: SHARE,
 *      }
 * Actions a minion takes upon receiving a SHARE event that applies to them:
 *      - show a modal window that blocks user from pressing anything other than stop
 *          - when stop is pressed, a minion sends a STOP_MIRRORING event (described below)
 *      - save the name of the preset that is controlling you
 *
 *
 * To stop sharing:
 *      {
 *          requestor: the name of the preset that is stopping sharing,
 *          device: list of displays that you are still controlling (bc some may have left),
 *          Key: STOP_SHARE,
 *      }
 * Actions a minion takes upon receiving a STOP_SHARE event that applies to them:
 *      - delete any extra inputs that have been created
 *      - remove the modal window
 *
 *
 * If you are a minion, and want the master to stop controlling your displays, send:
 *      {
 *          requestor: the name of the preset that is controlling you,
 *          device: list of the displays you want removed from being controlled (i.e. your displays),
 *          Key: LEAVE_SHARE
 *      }
 *      also, unmute/unblank yourself.
 * Actions a minion takes upon receiving a LEAVE_SHARE event:
 *      - if the displays in *device* match its displays
 *          - unmute/unblank
 *          - switch back to my local input (?)
 * Actions a master takes upon receiving a LEAVE_SHARE event:
 *      -   remove each display in *device* field from current preset
 *          - if a roomWideAudio was removed:
 *              - change sharePreset.audioDevices to be your default preset's audioDevices
 *              - unmute your audioDevices
 *
 *
 * If you are a minion who has left the group, and would like to rejoin, send:
 *      {
 *          requestor: the name of the preset who is requesting me to join the group
 *          device: list of displays you want to be controlled,
 *          Key: JOIN_SHARE
 *          Value: the name of the preset that that started the group,
 *      }
 *      also show the same modal window that appears when receiving a SHARE event
 *      and lookup the status of the preset you would like to join, and mirror that.
 * Actions a minion takes upon receiving a JOIN_SHARE event:
 *      - if their displays are in the *device* field
 *          - lookup the status of the preset defined in the requestor field, and mirror that
 *          - show the SHARE modal window
 * Actions a master takes upon receiving a JOIN_SHARE event:
 *      - add each display from *device* into the current preset.
 *          - if a roomWideAudio was added:
 *              - change sharePreset.audioDevices to be the roomWideAudio.
 *              - mute everything that isn't a roomWideAudio
 */

@Component({
  selector: "home",
  templateUrl: "home.component.html",
  styleUrls: ["home.component.scss", "../colorscheme.scss"]
})
export class HomeComponent implements OnInit {
  @ViewChild(WheelComponent)
  public wheel: WheelComponent;

  sharePreset: Preset;
  defaultPreset: Preset;

  selectedDisplays: Display[] = [];

  mirrorPresetName: string;

  helpInfo: HelpInfo;

  @ViewChild("selectdisplays")
  selectDisplaysDialog: SwalComponent;
  @ViewChild("unshare")
  unShareDialog: SwalComponent;
  @ViewChild("mirror")
  mirrorDialog: SwalComponent;
  @ViewChild("audio")
  audioDialog: SwalComponent;
  @ViewChild("notRoutable")
  notRoutableDialog: SwalComponent;

  constructor(
    public data: DataService,
    private socket: SocketService,
    public api: APIService,
    public readonly swalTargets: SwalPartialTargets,
    public command: CommandService,
    private graph: GraphService,
    private dialog: MatDialog
  ) {
    this.data.loaded.subscribe(() => {
      this.updateFromEvents();
      this.setupInputFunctions();
      this.setupDialogs();

      this.updateHelp();
    });
  }

  public ngOnInit() {}

  private setupInputFunctions() {
    console.log("setting up input functions");
    for (const i of this.data.inputs) {
      // define what happens when the input is clicked
      i.click.subscribe(() => {
        if (
          this.wheel.preset === this.sharePreset &&
          i.reachableDisplays.length === 1
        ) {
          this.notRoutableDialog.show();
          return;
        }
        this.command.setInput(i, this.wheel.preset.displays);
      });
    }
  }

  public log(something: object) {
    console.log(something);
  }

  private setupDialogs() {
    this.unShareDialog.options = {
      title: "Returning room to default state...",
      allowOutsideClick: false
    };

    this.mirrorDialog.options = {
      type: "info",
      focusConfirm: false,
      confirmButtonText: "Stop",
      allowOutsideClick: false,
      width: "85vw"
    };

    /*
    this.selectDisplaysDialog.options = {
      text: "i should be hidden",
      focusConfirm: false,
      confirmButtonText: "Share",
      showCancelButton: true,
      width: "85vw",
      showLoaderOnConfirm: true,
      preConfirm: () => {
        const names: string[] = [];
        for (const d of this.selectedDisplays) {
          names.push(d.name);
        }

        for (const d of this.defaultPreset.displays) {
          names.push(d.name);
        }

        // just make sure that things don't crash
        if (
          this.wheel.preset != null &&
          this.wheel.preset.displays[0] != null &&
          this.wheel.preset.displays[0].input != null
        ) {
          this.command.buttonPress("share", {
            input: this.wheel.preset.displays[0].input.name,
            displays: names
          });
        }

        return new Promise((resolve, reject) => {
          this.share(this.selectedDisplays, true).subscribe(success => {
            if (success) {
              this.swalStatus(true);
              resolve();
            } else {
              this.swalStatus(false);
              reject();
            }
          });
        });
      }
    };
    */

    this.notRoutableDialog.options = {
      text: "i should be hidden",
      showCancelButton: false,
      showConfirmButton: true,
      confirmButtonText: "Ok",
      focusConfirm: true,
      timer: 5000
    };
  }

  private onWheelInit() {
    this.defaultPreset = this.wheel.preset;

    if (this.wheel.getPower() === "on") {
      this.wheel.open(false, 500);
    }
  }

  public turnOn(): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = this.wheel.command.powerOnDefault(
      this.wheel.preset
    );

    ret.subscribe(success => {
      if (success) {
        this.wheel.open(false, 200);
      }
    });

    return ret;
  }

  public turnOff = (): EventEmitter<boolean> => {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();

    if (this.wheel.preset === this.sharePreset) {
      // unshare first
      this.unShare(true).subscribe(success => {
        if (success) {
          // power off this preset
          this.wheel.command
            .powerOff(this.wheel.preset)
            .subscribe(successTwo => {
              if (successTwo) {
                this.wheel.close();
                ret.emit(true);
              } else {
                console.warn("failed to power off preset");
                ret.emit(false);
              }
            });
        } else {
          console.warn("failed to unshare to turn off preset.");
          ret.emit(false);
        }
      });
    } else {
      // power off this preset.
      this.wheel.command.powerOff(this.wheel.preset).subscribe(success => {
        if (success) {
          this.wheel.close();
          ret.emit(true);
        } else {
          console.warn("failed to power off preset");
          ret.emit(false);
        }
      });
    }

    return ret;
  };

  buildSharePreset = (from: Preset, to: Preset[]): Preset => {
    // create a new preset that controls what i should control now
    let displays = from.displays.slice();
    to.forEach(p => displays.push(...p.displays));
    displays = Array.from(new Set(displays));

    const audioDevices = from.audioDevices.slice();
    const audioConfigs = this.data.getAudioConfigurations(displays);

    if (this.data.hasRoomWide(audioConfigs)) {
      audioDevices.length = 0;

      for (const config of audioConfigs) {
        if (config.roomWide) {
          audioDevices.push(...config.audioDevices);
        }
      }
    }

    // build the new preset
    return new Preset(
      "Sharing",
      "subscriptions",
      displays,
      Array.from(new Set(audioDevices)),
      from.inputs,
      from.shareablePresets,
      from.independentAudioDevices,
      from.commands
    );
  };

  share = (from: Preset, to: Preset[]): Action => {
    return async (): Promise<boolean> => {
      return new Promise<boolean>((resolve, reject) => {
        console.log("sharing from", from, "to", to);

        // if you share, you can't go back to and old group anymore
        this.removeExtraInputs();

        const preset = this.buildSharePreset(from, to);
        console.log("share preset", preset);

        this.command.share(from, to).subscribe(success => {
          if (success) {
            this.sharePreset = preset;
            this.changePreset(this.sharePreset);

            // send an event notifying everyone i just shared to them
            const names: string[] = [];
            to.forEach(p => names.push(p.name));

            const event = new Event();

            event.User = from.name;
            event.EventTags = ["ui-communication"];
            event.AffectedRoom = new BasicRoomInfo(
              APIService.building + "-" + APIService.roomName
            );
            event.TargetDevice = new BasicDeviceInfo(
              event.AffectedRoom.RoomID + "-" + names.join(",")
            );
            event.Key = SHARE;
            event.Value = " ";

            this.api.sendEvent(event);
          }

          resolve(success);
        });
      });
    };
  };

  unShare = (b: boolean): EventEmitter<boolean> => {
    return new EventEmitter<boolean>();
  };

  // from should be the default preset, to should be the list of presets i'm sharing to
  unshare = (from: Preset, to: Preset[]): EventEmitter<boolean> => {
    const ret = new EventEmitter<boolean>();
    console.log("unsharing from", from, "to", to);

    this.command.unshare(from, to).subscribe(success => {
      if (success) {
        this.changePreset(from);

        // send an event notifying everyone i just stopped sharing to them
        const names: string[] = [];
        to.forEach(p => names.push(p.name));

        const event = new Event();
        event.User = from.name;
        event.EventTags = ["ui-communication"];
        event.AffectedRoom = new BasicRoomInfo(
          APIService.building + "-" + APIService.roomName
        );
        event.TargetDevice = new BasicDeviceInfo(
          event.AffectedRoom.RoomID + "-" + names.join(",")
        );
        event.Key = STOP_SHARE;
        event.Value = " ";

        this.api.sendEvent(event);
      }

      ret.emit(success);
    });

    return ret;
  };

  /*
  public unShare(sendCommand: boolean): EventEmitter<boolean> {
    if (sendCommand) {
    } else {
      this.changePreset(this.defaultPreset);
      this.swalStatus(true);
    }

    return ret;
  }

  public share(
    displayList: Display[],
    sendCommand: boolean
  ): EventEmitter<boolean> {
    if (sendCommand) {
        if (success) {
          this.selectedDisplays = displayList;
        }
    } else {
      this.selectedDisplays = displayList;
      this.changePreset(this.sharePreset);
    }

    return ret;
  }
*/

  /*
   * Tell the minion to mirror a specific preset.
   */
  public mirror(preset: Preset, sendCommand: boolean, sendEvent: boolean) {
    // show the popup
    this.mirrorDialog.show();
    console.log("mirroring", preset.name);

    if (this.wheel.preset === this.sharePreset) {
      console.log("switching to default preset");
      this.changePreset(this.defaultPreset);
    }

    if (sendCommand) {
      console.log("sending mirror command");
      this.wheel.command
        .mirror(preset, this.defaultPreset)
        .subscribe(success => {
          if (success) {
            const names: string[] = [];
            this.wheel.preset.displays.forEach(d => names.push(d.name));
            const displays: string = names.join(",");

            if (sendEvent) {
              console.log("sending JOIN_SHARE event as part of mirror");
              const event = new Event();

              event.User = this.defaultPreset.name;
              event.EventTags = ["ui-communication"];
              event.AffectedRoom = new BasicRoomInfo(
                APIService.building + "-" + APIService.roomName
              );
              event.TargetDevice = new BasicDeviceInfo(
                event.AffectedRoom.RoomID + "-" + displays
              );
              event.Key = JOIN_SHARE;
              event.Value = preset.name;

              this.api.sendEvent(event);
            }
          }
        });
    }

    // create and push a new input based on the new current input
    this.mirrorPresetName = preset.name;

    const currInput = this.wheel.getInput();
    if (currInput != null) {
      const input = new Input(
        currInput.name,
        preset.name,
        currInput.icon,
        currInput.reachableDisplays
      );
      input.click.subscribe(() => {
        this.command.buttonPress("remirror", preset.name);
        this.mirror(preset, true, true);
      });

      this.removeExtraInputs();
      this.defaultPreset.extraInputs.push(input);
    } else {
      console.warn("failed to find a current input for preset:", preset);
    }
  }

  public unMirror(sendCommand: boolean) {
    console.log("unmirroring");
    if (sendCommand) {
      console.log("sending unmirror command");
      const names: string[] = [];
      this.wheel.preset.displays.forEach(d => names.push(d.name));
      const displays: string = names.join(",");

      const event = new Event();

      event.User = this.mirrorPresetName;
      event.EventTags = ["ui-communication"];
      event.AffectedRoom = new BasicRoomInfo(
        APIService.building + "-" + APIService.roomName
      );
      event.TargetDevice = new BasicDeviceInfo(
        event.AffectedRoom.RoomID + "-" + displays
      );
      event.Key = LEAVE_SHARE;
      event.Value = " ";

      this.api.sendEvent(event);

      // switch the input back to default
      this.wheel.command.powerOnDefault(this.defaultPreset);
    }

    this.swalStatus(true);
  }

  private removeFromShare(displays: Display[]) {
    // remove displays from list of current displays
    this.sharePreset.displays = this.sharePreset.displays.filter(
      d => !displays.includes(d)
    );
    console.log("removed", displays, " from my share group");

    const audioConfigs = this.data.getAudioConfigurations(displays);
    const hasRoomWide = this.data.hasRoomWide(audioConfigs);

    if (hasRoomWide) {
      console.log("removed room wide audio device. changing preset...");

      // switch back to default presets audio devices
      this.sharePreset.audioDevices = this.defaultPreset.audioDevices.slice();

      // set volume to 30 on my audio devices
      /* TODO
      this.wheel.command.setMuteAndVolume(
        false,
        30,
        this.sharePreset.audioDevices
      );
      */
    } else {
      console.log("no room wide audioDevices removed.");
    }

    console.log("share preset after removing displays:", this.sharePreset);
  }

  private addToShare(displays: Display[]) {
    this.sharePreset.displays.push(...displays);
    console.log("added", displays, "to my share group");

    const audioConfigs = this.data.getAudioConfigurations(displays);
    const hasRoomWide = this.data.hasRoomWide(audioConfigs);

    if (hasRoomWide) {
      console.log("added room wide audio device. changing preset...");

      // mute current audio device before switching
      /* TODO
      this.wheel.command
        .setMuteAndVolume(true, 0, this.sharePreset.audioDevices)
        .subscribe(() => {
          this.sharePreset.audioDevices.length = 0;

          // add all room wide audios to the sharePreset
          for (const config of audioConfigs) {
            if (config.roomWide) {
              this.sharePreset.audioDevices.push(...config.audioDevices);
            }
          }

          // unmute and set volume to 30 for the room wide audios
          this.wheel.command.setMuteAndVolume(
            false,
            30,
            this.sharePreset.audioDevices
          );
        });
        */
    } else {
      console.log("no room wide audioDevices added");
    }

    console.log("share preset after adding displays:", this.sharePreset);
  }

  private updateFromEvents() {
    this.socket.getEventListener().subscribe(event => {
      if (event.type === MESSAGE) {
        const e = event.data;

        let split: string[] = [];
        if (e.TargetDevice !== undefined) {
          split = e.TargetDevice.DeviceID.split("-");
        }

        if (e.Value.length > 0 && split.length === 3) {
          switch (e.Key) {
            case POWER:
              if (
                e.Value === "standby" &&
                this.wheel.preset.displays.find(d => d.name === split[2]) !=
                  null
              ) {
                this.removeExtraInputs();
              }

              break;
            case INPUT:
              if (this.defaultPreset.extraInputs.length > 0) {
                const input = Input.getInput(e.Value, this.data.inputs);
                if (!this.defaultPreset.inputs.includes(input)) {
                  console.log("updating extra input name/icon with: ", input);
                  this.defaultPreset.extraInputs[0].name = input.name;
                  this.defaultPreset.extraInputs[0].icon = input.icon;
                }
              }
              break;
            case SHARE:
              if (e.User === this.defaultPreset.name) {
                console.log(
                  "a panel i'm mirroring (" + e.User + ") just shared"
                );
                // someone who's panel i'm supposed to mirror just shared.
                // so i should look like i'm sharing too!
                // split[2] has the displays i should be sharing to.

                const names = split[2].split(",");
                const displays = Display.getDisplayListFromNames(
                  names,
                  this.data.displays
                );

                // TODO
                // this.share(displays, false);
              } else if (this.appliesToMe(split[2].split(","))) {
                console.log(e.User, "just shared to me");
                if (this.wheel.preset === this.sharePreset) {
                  console.log("and i'm already sharing to a group.");
                  // e.User just shared to me, but I'm already sharing to a group.
                  // the preset who just shared to me should absorb my group.
                  const displaysThatWereSharedTo = Display.getDisplayListFromNames(
                    split[2].split(","),
                    this.data.displays
                  );

                  const names: string[] = [];
                  this.selectedDisplays.forEach(d => {
                    // only force my displays that weren't shared to, but are in my group, to join the new group.
                    if (!displaysThatWereSharedTo.includes(d)) {
                      names.push(d.name);
                    }
                  });

                  if (names.length > 0) {
                    const displays = names.join(",");

                    const eve = new Event();

                    eve.User = this.defaultPreset.name;
                    eve.EventTags = ["ui-communication"];
                    eve.AffectedRoom = new BasicRoomInfo(
                      APIService.building + "-" + APIService.roomName
                    );
                    eve.TargetDevice = new BasicDeviceInfo(
                      event.AffectedRoom.RoomID + "-" + displays
                    );
                    eve.Key = JOIN_SHARE;
                    eve.Value = e.User;

                    this.api.sendEvent(eve);
                  }
                }

                // someone shared to me. i should look like a minion.
                const preset = this.data.presets.find(p => p.name === e.User);
                this.mirror(preset, false, false);
              } else if (
                this.appliesToMySelectedDisplays(split[2].split(","))
              ) {
                // display(s) that i previously shared to have been shared to by a new station.
                // they should be removed from my selectedDisplays group so that
                // i can't send an unshare event to them.
                console.log(
                  e.User,
                  "just shared to display(s) that i was sharing to"
                );
                const displaysThatWereSharedTo = Display.getDisplayListFromNames(
                  split[2].split(","),
                  this.data.displays
                );

                // remove displays that were shared from the selectedDisplays
                this.selectedDisplays = this.selectedDisplays.filter(
                  d => !displaysThatWereSharedTo.includes(d)
                );

                if (this.selectedDisplays.length === 0) {
                  console.log("i'm no longer sharing to any displays. :(");
                  this.unShare(false);
                } else {
                  console.log(
                    "selected displays (displays that will receive an unshare event) after removing them: ",
                    this.selectedDisplays
                  );
                }
              }
              break;
            case STOP_SHARE:
              if (
                this.wheel.preset === this.sharePreset &&
                e.User === this.defaultPreset.name
              ) {
                console.log("a panel i'm mirroring just unshared");
                // someone who's panel i'm mirroring just unshared.
                // all i need to do is switch back to my default preset

                this.unShare(false);
              } else if (this.appliesToMe(split[2].split(","))) {
                console.log(e.User, "just stopped sharing with me");
                // someone stopped sharing to me.
                this.unMirror(false);
                this.removeExtraInputs();
              }
              break;
            case LEAVE_SHARE:
              if (this.appliesToMe(split[2].split(","))) {
                console.log(
                  "a panel i'm mirroring just left",
                  e.User + "'s group."
                );
                // someone who's panel i'm mirroring just left a group

                this.unMirror(false);
              } else if (e.User === this.defaultPreset.name) {
                console.log(split[2], "has left my group");

                const names = split[2].split(",");
                const displays = Display.getDisplayListFromNames(
                  names,
                  this.data.displays
                );
                this.removeFromShare(displays);
              }
              break;
            case JOIN_SHARE:
              if (
                this.wheel.preset === this.sharePreset &&
                e.Value === this.defaultPreset.name
              ) {
                // someone wants to join *my* group
                const names = split[2].split(",");
                let displays = Display.getDisplayListFromNames(
                  names,
                  this.data.displays
                );

                // remove displays that are already part of my sharePreset
                displays = displays.filter(
                  d => !this.sharePreset.displays.includes(d)
                );

                if (displays.length > 0) {
                  console.log(
                    displays,
                    "are joining my group at the request of",
                    e.User
                  );
                  this.addToShare(displays);
                }
              } else if (e.User === this.defaultPreset.name) {
                console.log(
                  "a panel i'm mirroring just rejoined",
                  e.Value + "'s group."
                );
                // a panel i'm mirroring just rejoined a group

                const preset = this.data.presets.find(p => p.name === e.Value);
                this.mirror(preset, false, false);
              } else if (this.appliesToMe(split[2].split(","))) {
                console.log(
                  e.User,
                  "wants me to join a ",
                  e.Value + "'s group."
                );
                // someone wants me to join a group

                const preset = this.data.presets.find(p => p.name === e.Value);
                this.mirror(preset, true, false);
              }
              break;
            case POWER_OFF_ALL:
              this.removeExtraInputs();
              swal.close();

              if (this.sharePreset === this.wheel.preset) {
                this.unShare(true).subscribe(success => {
                  if (success) {
                    this.wheel.command.powerOffAll();
                  }
                });
              }

              break;
          }
        } else {
          console.warn("<home comonent> invalid event: ", e);
        }
      }
    });
  }

  private appliesToMe(listOfDisplayNames: string[]): boolean {
    for (const d of this.defaultPreset.displays) {
      if (listOfDisplayNames.includes(d.name)) {
        return true;
      }
    }
    return false;
  }

  private appliesToMySelectedDisplays(listOfDisplayNames: string[]): boolean {
    for (const d of this.selectedDisplays) {
      if (listOfDisplayNames.includes(d.name)) {
        return true;
      }
    }
    return false;
  }

  private removeExtraInputs() {
    this.wheel.preset.extraInputs.length = 0;
    this.defaultPreset.extraInputs.length = 0;
    setTimeout(() => this.wheel.render(), 0);
  }

  private changePreset(newPreset: Preset) {
    console.log("changing preset to", newPreset);
    this.wheel.preset = newPreset;
    setTimeout(() => this.wheel.render(), 0);
  }

  private swalStatus(success: boolean): void {
    if (!swal.isVisible()) {
      return;
    }

    if (success) {
      swal({
        type: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      swal({
        type: "error",
        timer: 1500,
        showConfirmButton: false
      });
    }
  }

  public isSelected(d: Display) {
    return this.selectedDisplays.includes(d);
  }

  public showAudioControl(from: SwalComponent) {
    this.audioDialog.show().then(result => {
      from.show();
    });
  }

  public updateHelp() {
    this.helpInfo = this.getHelp();
    console.log("updated help info", this.helpInfo);

    setInterval(() => {
      this.helpInfo = this.getHelp();
      console.log("updated help info", this.helpInfo);
    }, 1 * 60 * 1000);
  }

  public getHelp(): HelpInfo {
    const date = new Date();
    const dayOfTheWeek = date.getDay();
    const CurrentHour = date.getHours();
    let dayOfWeekString = "sunday";
    switch (dayOfTheWeek) {
      case 1:
        dayOfWeekString = "monday";
        break;
      case 2:
        dayOfWeekString = "tuesday";
        break;
      case 3:
        dayOfWeekString = "wednesday";
        break;
      case 4:
        dayOfWeekString = "thursday";
        break;
      case 5:
        dayOfWeekString = "friday";
        break;
      case 6:
        dayOfWeekString = "saturday";
        break;
      default:
        break;
    }

    const ret: HelpInfo = {
      msg: "",
      showConfirm: false
    };

    if (APIService.helpConfig == null) {
      ret.msg = "Unable to get help message.";
      return ret;
    } else if (APIService.helpConfig["helpHours"][dayOfWeekString] == null) {
      ret.msg = "Help hours are not defined for " + dayOfWeekString + ".";
      return ret;
    }

    if (
      APIService.helpConfig["helpHours"][dayOfWeekString].open &&
      CurrentHour >= APIService.helpConfig["helpHours"][dayOfWeekString].from &&
      CurrentHour < APIService.helpConfig["helpHours"][dayOfWeekString].to
    ) {
      ret.msg = APIService.helpConfig["helpMessage"]["workHours"];
      ret.showConfirm = true;
      return ret;
    } else {
      ret.msg = APIService.helpConfig["helpMessage"]["afterHours"];
    }

    return ret;
  }

  public getPresetDisplayNames(preset: Preset): string[] {
    const displays: string[] = [];

    if (preset == null || preset.displays == null) {
      return displays;
    }

    for (const d of preset.displays) {
      displays.push(d.name);
    }

    return displays;
  }

  public showHelp() {
    const ref = this.dialog.open(HelpModal, {
      width: "80vw",
      data: this.helpInfo,
      disableClose: true
    });
  }

  public showPowerOffDialog() {
    const ref = this.dialog.open(PowerOffAllModalComponent, {
      width: "80vw",
      disableClose: true,
      data: this.turnOff
    });
  }

  public showShareModal() {
    const ref = this.dialog.open(ShareModalComponent, {
      width: "80vw",
      disableClose: true,
      data: {
        wheel: this.wheel,
        share: this.share
      }
    });
  }

  public showAudioModal() {
    const ref = this.dialog.open(AudioModalComponent, {
      width: "80vw",
      disableClose: true,
      data: this.defaultPreset
    });
  }
}
