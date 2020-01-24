import {
  Component,
  ViewChild,
  EventEmitter,
  Output as AngularOutput,
  OnInit
} from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material";
import { deserialize } from "serializer.ts/Serializer";
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
import { AudioComponent } from "./audio/audio.component";
import { MirrorModalComponent } from "../modals/mirrormodal/mirrormodal.component";
import { MessageModalComponent } from "../modals/messagemodal/messagemodal.component";
import { Action } from "./activity-button/activity-button.component";
import { StreamModalComponent } from "app/modals/streammodal/streammodal.component";
import { ProjectorComponent } from "./projector/projector.component";
import { MobileControlModal } from "../modals/mobilecontrolmodal/mobilecontrolmodal.component";


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

  @ViewChild(AudioComponent)
  public audio: AudioComponent;

  @ViewChild(ProjectorComponent)
  public screen: ProjectorComponent

  public controlKey: string;
  public roomControlUrl: string;
  sharePreset: Preset;
  defaultPreset: Preset;

  mirroringMe: Preset[] = [];

  helpInfo: HelpInfo;

  constructor(
    public data: DataService,
    private socket: SocketService,
    public api: APIService,
    public command: CommandService,
    private graph: GraphService,
    private dialog: MatDialog
  ) {
    this.data.loaded.subscribe(() => {
      this.updateFromEvents();
      this.setupInputFunctions();

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
          this.showMessageModal(
            undefined,
            "You must unshare before you can select this input.",
            false,
            "Ok"
          );
          return;
        }

        if (i.subInputs !== undefined && i.subInputs.length > 0) {
          this.dialog.open(StreamModalComponent, { data: i }).afterClosed().subscribe((theChosenOne) => {
            if (theChosenOne !== undefined) {
              const input = theChosenOne as Input;
              this.command.setInput(input, this.wheel.preset.displays);
            }
            return;
          })
        } else {
          console.log("no sub inputs");
          this.command.setInput(i, this.wheel.preset.displays);
        }
      });
    }
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
      this.unshare(this.defaultPreset, this.mirroringMe).subscribe(success => {
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
      from.screens,
      from.shareablePresets,
      from.independentAudioDevices,
      from.commands
    );
  };

  share = (from: Preset, to: Preset[]): Action => {
    return async (): Promise<boolean> => {
      return new Promise<boolean>((resolve, reject) => {
        console.log("sharing from", from, "to", to);

        // if you share, you can't go back to an old group anymore
        this.removeExtraInputs();

        const preset = this.buildSharePreset(from, to);
        console.log("share preset", preset);

        this.command.share(from, to).subscribe(success => {
          if (success) {
            this.mirroringMe.push(...to);
            this.sharePreset = preset;
            this.changePreset(this.sharePreset);

            const event = new Event();

            event.User = from.name;
            event.EventTags = ["ui-communication"];
            event.AffectedRoom = new BasicRoomInfo(
              APIService.building + "-" + APIService.roomName
            );
            event.TargetDevice = new BasicDeviceInfo(APIService.piHostname);
            event.Key = SHARE;
            event.Value = " ";
            event.Data = this.mirroringMe.map(p => p.name);

            this.api.sendEvent(event);
          }

          resolve(success);
        });
      });
    };
  };

  // from should be the default preset, to should be the list of presets i'm sharing to
  unshare = (from: Preset, to: Preset[]): EventEmitter<boolean> => {
    const ret = new EventEmitter<boolean>();
    console.log("unsharing from", from, "to", to);

    // show the unshare popup
    const ref = this.showMessageModal(
      "Returning room to default state...",
      undefined,
      true,
      undefined
    );

    this.command.unshare(from, to).subscribe(success => {
      if (success) {
        this.changePreset(from);
        this.mirroringMe = this.mirroringMe.filter(p => !to.includes(p));

        const event = new Event();
        event.User = from.name;
        event.EventTags = ["ui-communication"];
        event.AffectedRoom = new BasicRoomInfo(
          APIService.building + "-" + APIService.roomName
        );
        event.TargetDevice = new BasicDeviceInfo(APIService.piHostname);
        event.Key = STOP_SHARE;
        event.Value = " ";
        event.Data = to.map(p => p.name);

        this.api.sendEvent(event);
      }

      ref.close();
      ret.emit(success);
    });

    return ret;
  };

  mirror = (preset: Preset) => {
    const input = this.buildMirrorInput(preset);
    const ref = this.showMirrorModal(input);

    console.log("mirroring", preset.name);

    if (this.wheel.preset === this.sharePreset) {
      console.log("switching to default preset");
      this.changePreset(this.defaultPreset);
    }

    this.command.mirror(this.defaultPreset, preset).subscribe(success => {
      if (success) {
        // tell panels mirroring me to show that they are mirroring them too
        const event = new Event();
        event.User = this.defaultPreset.name;
        event.EventTags = ["ui-communication"];
        event.AffectedRoom = new BasicRoomInfo(
          APIService.building + "-" + APIService.roomName
        );
        event.TargetDevice = new BasicDeviceInfo(APIService.piHostname);
        event.Key = JOIN_SHARE;
        event.Value = preset.name;
        event.Data = [this.defaultPreset.name];

        this.api.sendEvent(event);
      }
    });

    this.removeExtraInputs();
    this.defaultPreset.extraInputs.push(input);
  };

  buildMirrorInput = (preset: Preset): Input => {
    const currInput = this.wheel.getInput();

    if (currInput != null) {
      const input = new Input(
        currInput.name,
        preset.name,
        currInput.icon,
        currInput.reachableDisplays,
        currInput.subInputs
      );

      input.click.subscribe(() => {
        this.command.buttonPress("remirror", preset.name);
        this.mirror(preset);
      });

      return input;
    } else {
      console.warn("failed to find a current input for preset:", preset);
      return undefined;
    }
  };

  removeMirrorPopup = () => {
    for (const dialog of this.dialog.openDialogs) {
      if (dialog.componentInstance instanceof MirrorModalComponent) {
        dialog.close();
      }
    }
  };

  unmirror = (): Action => {
    return async (): Promise<boolean> => {
      return new Promise<boolean>((resolve, reject) => {
        console.log("unmirroring");

        // switch the input back to default
        this.command.powerOnDefault(this.defaultPreset).subscribe(success => {
          const event = new Event();
          event.User = this.defaultPreset.name;
          event.EventTags = ["ui-communication"];
          event.AffectedRoom = new BasicRoomInfo(
            APIService.building + "-" + APIService.roomName
          );
          event.TargetDevice = new BasicDeviceInfo(APIService.piHostname);
          event.Key = LEAVE_SHARE;
          event.Value = this.defaultPreset.name;
          event.Data = [this.defaultPreset.name];

          this.api.sendEvent(event);

          resolve(success);
          this.removeMirrorPopup();
        });
      });
    };
  };

  private removeFromShare = (presets: Preset[]) => {
    if (this.wheel.preset !== this.sharePreset) {
      console.warn(
        "trying to remove",
        presets,
        "from my share group, but i'm not currently sharing"
      );
      return;
    }

    // only keep displays that i'm mirroring to
    const trash: Display[] = [];
    for (const preset of presets) {
      trash.push(...preset.displays);
    }

    this.sharePreset.displays = this.sharePreset.displays.filter(
      disp => !trash.some(d => d.name === disp.name)
    );

    this.sharePreset = this.fixAudio(this.sharePreset);
    console.log("new share preset", this.sharePreset);
  };

  // the presets have already set their inputs to match mine
  private addToShare = (presets: Preset[]) => {
    if (this.wheel.preset !== this.sharePreset) {
      console.warn(
        "trying to add",
        presets,
        "to my share group, but i'm not currently sharing"
      );
      return;
    }

    console.log("adding", presets, "to my share group");
    this.mirroringMe.push(...presets);

    for (const preset of presets) {
      this.sharePreset.displays.push(...preset.displays);
    }

    this.sharePreset = this.fixAudio(this.sharePreset);
    console.log("new share preset", this.sharePreset);
  };

  private fixAudio = (preset: Preset): Preset => {
    const audioConfigs = this.data.getAudioConfigurations(preset.displays);
    const hasRoomWide = this.data.hasRoomWide(audioConfigs);

    if (hasRoomWide) {
      const tomute: AudioDevice[] = [];
      audioConfigs
        .filter(config => !config.roomWide)
        .forEach(config => tomute.push(...config.audioDevices));

      // mute all the non-roomwide audio devices, unmute the room wide audios
      this.command.setMute(true, tomute);

      // unmute all the roomwide audio devices, set their volume to 30
      preset.audioDevices.length = 0;
      audioConfigs
        .filter(config => config.roomWide)
        .forEach(config => preset.audioDevices.push(...config.audioDevices));
    } else {
      // make sure audio is coming from my preset
      preset.audioDevices = this.defaultPreset.audioDevices;
    }

    this.command.setVolume(30, preset.audioDevices);
    this.command.setMute(false, preset.audioDevices);
    return preset;
  };

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
                this.wheel.preset.displays.find(d => d.name === split[2])
              ) {
                this.dialog.closeAll();
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
                  "a panel i'm mirroring (" + e.User + ") just shared to",
                  e.Value
                );

                // someone who's panel i'm supposed to mirror just shared.
                // so i should look like i'm sharing too!
                const presets: Preset[] = [];
                for (const name of e.Data) {
                  const preset = this.data.presets.find(p => p.name === name);
                  if (preset) {
                    presets.push(preset);
                  }
                }

                this.sharePreset = this.buildSharePreset(
                  this.defaultPreset,
                  presets
                );

                this.changePreset(this.sharePreset);
                this.mirroringMe = presets;
              } else if (this.appliesToMe(e.Data)) {
                console.log(e.User, "just shared to me");

                if (this.wheel.preset === this.sharePreset) {
                  console.log("and i'm already sharing to a group.");
                  // e.User just shared to me, but I'm already sharing to a group.
                  // the preset who just shared to me should absorb my group.
                  const presetsToMirror: string[] = [];
                  this.mirroringMe
                    .filter(p => !e.Data.includes(p.name))
                    .forEach(p => presetsToMirror.push(p.name));

                  if (presetsToMirror.length > 0) {
                    const eve = new Event();
                    eve.User = this.defaultPreset.name;
                    eve.EventTags = ["ui-communication"];
                    eve.AffectedRoom = new BasicRoomInfo(
                      APIService.building + "-" + APIService.roomName
                    );
                    eve.TargetDevice = new BasicDeviceInfo(
                      APIService.piHostname
                    );
                    eve.Key = JOIN_SHARE;
                    eve.Value = e.User;
                    eve.Data = this.mirroringMe
                      .filter(p => !e.Data.includes(p.name))
                      .map(p => p.name);

                    this.api.sendEvent(eve);
                  }

                  this.changePreset(this.defaultPreset);
                }

                // someone shared to me. i should look like a minion.
                const preset = this.data.presets.find(p => p.name === e.User);
                const input = this.buildMirrorInput(preset);
                this.removeExtraInputs();
                this.defaultPreset.extraInputs.push(input);

                // show the popup
                this.showMirrorModal(input);
              } else if (this.appliesToMyGroup(e.Data)) {
                // a preset that i previously shared to have been shared to by a new station.
                // they should be removed from my mirroringMe group so that
                // i don't send an unshare event to them.
                console.log(
                  e.User,
                  "just shared to preset(s) that i was sharing to"
                );

                this.mirroringMe = this.mirroringMe.filter(
                  p => !e.Data.includes(p.name)
                );

                if (this.mirroringMe.length === 0) {
                  console.log("i'm no longer sharing to any displays. :(");
                  this.changePreset(this.defaultPreset);
                } else {
                  console.log(
                    "presets still mirroring me after removing them:",
                    this.mirroringMe
                  );
                }
              }

              break;
            case STOP_SHARE:
              console.log("got unshare event, unshared to ", e.Data);
              if (
                this.wheel.preset === this.sharePreset &&
                e.User === this.defaultPreset.name
              ) {
                console.log("a panel i'm mirroring just unshared");

                // someone who's panel i'm mirroring just unshared.
                this.changePreset(this.defaultPreset);
              } else if (this.appliesToMe(e.Data)) {
                console.log(e.User, "just stopped sharing with me");
                this.removeExtraInputs();
                this.removeMirrorPopup();
              }
              break;
            case LEAVE_SHARE:
              if (this.appliesToMe(e.Data)) {
                console.log("a panel i'm mirroring just left our share group");

                // someone who's panel i'm mirroring just left a group
                this.removeMirrorPopup();
              } else if (this.mirroringMe.some(p => p.name === e.User)) {
                // someone i'm mirroring to left my group
                console.log(e.User, "has left my group");
                const preset = this.data.presets.find(p => p.name === e.User);

                this.removeFromShare([preset]);
              }

              break;
            case JOIN_SHARE:
              if (
                this.wheel.preset === this.sharePreset &&
                e.Value === this.defaultPreset.name
              ) {
                // someone wants to join *my* group
                const presets = this.data.presets.filter(p => {
                  return (
                    e.Data.includes(p.name) && !this.mirroringMe.includes(p)
                  );
                });

                if (presets.length > 0) {
                  console.log(
                    presets,
                    "are joining my group at the request of",
                    e.User
                  );

                  this.addToShare(presets);
                }
              } else if (e.User === this.defaultPreset.name) {
                console.log(
                  "a panel i'm mirroring just rejoined",
                  e.Value + "'s group."
                );

                // a panel i'm mirroring just rejoined a group
                const preset = this.data.presets.find(p => p.name === e.Value);
                const input = this.buildMirrorInput(preset);
                this.removeExtraInputs();
                this.defaultPreset.extraInputs.push(input);
              } else if (this.appliesToMe(e.Data)) {
                console.log(
                  e.User,
                  "wants me to join a ",
                  e.Value + "'s group."
                );

                // someone wants me to join a group
                const preset = this.data.presets.find(p => p.name === e.Value);
                this.mirror(preset); // TODO i might not want to send the event here, but lets test it
              }
              break;

            case POWER_OFF_ALL:
              this.removeExtraInputs();
              this.dialog.closeAll();

              if (this.sharePreset === this.wheel.preset) {
                this.unshare(this.defaultPreset, this.mirroringMe).subscribe(
                  success => {
                    this.changePreset(this.defaultPreset);
                    this.command.powerOffAll();
                  }
                );
              }

              break;
          }
        } else {
          console.warn("<home component> invalid event: ", e);
        }
      }
    });
  }

  private appliesToMe(listOfPresetNames: string[]): boolean {
    return listOfPresetNames.includes(this.defaultPreset.name);
  }

  private appliesToMyGroup(listOfPresetNames: string[]): boolean {
    return this.mirroringMe.some(p => listOfPresetNames.includes(p.name));
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

  /*
  public showAudioModal() {
    const ref = this.dialog.open(AudioModalComponent, {
      width: "80vw",
      disableClose: true,
      data: this.defaultPreset
    });
  }
  */

  public showMessageModal(
    title: string,
    message: string,
    showSpinner: boolean,
    closeText: string
  ): MatDialogRef<MessageModalComponent> {
    return this.dialog.open(MessageModalComponent, {
      width: "80vw",
      disableClose: true,
      data: {
        title: title,
        message: message,
        showSpinner: showSpinner,
        closeText: closeText
      }
    });
  }

  public showMirrorModal(input: Input): MatDialogRef<MirrorModalComponent> {
    return this.dialog.open(MirrorModalComponent, {
      width: "80vw",
      disableClose: true,
      data: {
        preset: this.defaultPreset,
        audio: this.audio,
        input: input,
        unmirror: this.unmirror
      }
    });
  }

  public showMobileControl() {
    const ref = this.dialog.open(MobileControlModal, {
      width: "80vw",
    });
  }
}
