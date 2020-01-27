import { Injectable, EventEmitter, ViewChild, ElementRef } from "@angular/core";
import {
  Http,
  Response,
  Headers,
  RequestOptions,
  Request
} from "@angular/http";
import { Observable } from "rxjs/Rx";
import { MatSliderChange, MatDialog } from "@angular/material";

import { APIService } from "./api.service";
import { DataService } from "./data.service";
import { Event, BasicDeviceInfo, BasicRoomInfo } from "./socket.service";
import { Input, Display, AudioDevice } from "../objects/status.objects";
import { Preset, AudioConfig, ConfigCommand, DeviceConfiguration } from "../objects/objects";

import "rxjs/add/operator/map";
import "rxjs/add/operator/timeout";
import { deserialize } from "serializer.ts/Serializer";
import { ErrorDialogComponent } from "../dialogs/error/error.component";
import {
  ErrorService,
  SwitchInput,
  BlankDisplay,
  SetVolume,
  SetMute,
  MasterMute,
  MixLevel,
  MixMute,
  PowerOn,
  PowerOff
} from "./error.service";

const TIMEOUT = 12 * 1000;

class CommandRequest {
  req: Request;
  delay: number;

  constructor(req: Request, delay?: number) {
    this.req = req;

    if (delay) {
      this.delay = delay;
    } else {
      this.delay = 0;
    }
  }
}

@Injectable()
export class CommandService {
  public commandInProgress = false;
  public mobileEmitter: EventEmitter<boolean>


  private options: RequestOptions;

  constructor(
    private http: Http,
    private data: DataService,
    public api: APIService,
    public dialog: MatDialog,
    private es: ErrorService
  ) {
    const headers = new Headers();
    headers.append("content-type", "application/json");
    this.options = new RequestOptions({ headers: headers });
  }

  private put(data: any): Observable<Object> {
    return this.http
      .put(APIService.apiurl, data, this.options)
      .timeout(TIMEOUT)
      .map(res => res.json());
  }

  private putWithCustomTimeout(data: any, timeout: number): Observable<Object> {
    return this.http
      .put(APIService.apiurl, data, this.options)
      .timeout(timeout)
      .map(res => res.json());
  }

  public setPower(p: string, displays: Display[]): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("Setting power to", p, "on", displays);
    const prev = Display.getPower(displays);
    Display.setPower(p, displays);

    const body = { displays: [] };
    for (const d of displays) {
      body.displays.push({
        name: d.name,
        power: p
      });
    }

    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        Display.setPower(p, displays);
        ret.emit(false);
        this.dialog.open(ErrorDialogComponent, {
          data: "Failed to power on the system."
        });
      }
    );

    return ret;
  }

  public setInput(
    preset: Preset,
    i: Input,
    displays: Display[]
  ): EventEmitter<boolean> {
    i.click.emit();

    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("Changing input on", displays, "to", i.name);
    const prev = Display.getInput(displays);
    Display.setInput(i, displays);

    // because we also want to unblank for this ui
    const prevBlank = Display.getBlank(displays);
    Display.setBlank(false, displays);

    const body = { displays: [] };
    for (const d of displays) {
      body.displays.push({
        name: d.name,
        input: i.name,
        blanked: false
      });
    }

    const changeInputReq = new CommandRequest(
      new Request({
        method: "PUT",
        url: APIService.apiurl,
        body: body
        // TODO add some kind of 'do this based on the response' function
      })
    );
    const requests: CommandRequest[] = [changeInputReq];

    const commandsToUse = preset.displays.some(
      d => d.input && d.input.name !== i.name
    )
      ? preset.commands.inputDifferent
      : preset.commands.inputSame;

    if (commandsToUse) {
      for (const cmd of commandsToUse) {
        requests.push(this.buildRequest(cmd));
      }
    }

    console.log("executing requests:", requests);

    this.executeRequests(requests, 6 * 1000).subscribe(answer => {
      const rrMap: Map<Request, Response> = answer as Map<Request, Response>;

      let success = true;

      rrMap.forEach((v, k) => {
        if (!v.ok && success) {
          success = false;
          Display.setInput(prev, displays);
          Display.setBlank(prevBlank, displays);
          this.es.show(SwitchInput, v);
        }
      });

      ret.emit(success);
    });

    return ret;
  }

  public setBlank(b: boolean, displays: Display[]): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("Setting blanked to", b, "on", displays);
    const prev = Display.getBlank(displays);
    Display.setBlank(b, displays);

    const body = { displays: [] };
    for (const d of displays) {
      body.displays.push({
        name: d.name,
        blanked: b
      });
    }

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        Display.setBlank(prev, displays);
        ret.emit(false);
        this.commandInProgress = false;
        this.es.show(BlankDisplay, err);
      }
    );

    return ret;
  }

  public setVolume(
    v: number,
    audioDevices: AudioDevice[]
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("changing volume to", v, "on", audioDevices);
    const prev = AudioDevice.getVolume(audioDevices);
    AudioDevice.setVolume(v, audioDevices);

    const body = { audioDevices: [] };
    for (const a of audioDevices) {
      body.audioDevices.push({
        name: a.name,
        volume: v
      });
    }

    console.log("volume body", body);

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        AudioDevice.setVolume(prev, audioDevices);
        ret.emit(false);
        this.commandInProgress = false;
        this.es.show(SetVolume, err);
      }
    );

    return ret;
  }

  public setMute(
    m: boolean,
    audioDevices: AudioDevice[]
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("changing mute to", m, "on", audioDevices);
    const prev = AudioDevice.getMute(audioDevices);
    AudioDevice.setMute(m, audioDevices);

    const body = { audioDevices: [] };
    for (const a of audioDevices) {
      body.audioDevices.push({
        name: a.name,
        muted: m
      });
    }

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        AudioDevice.setMute(prev, audioDevices);
        ret.emit(false);
        this.commandInProgress = false;
        this.es.show(SetMute, err);
      }
    );

    return ret;
  }

  public setMuteAndVolume(
    m: boolean,
    v: number,
    audioDevices: AudioDevice[]
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("changing volume to", v, "and mute to", m, "on", audioDevices);
    const prevMute = AudioDevice.getMute(audioDevices);
    AudioDevice.setMute(m, audioDevices);

    const prevVol = AudioDevice.getVolume(audioDevices);
    AudioDevice.setVolume(v, audioDevices);

    const body = { audioDevices: [] };
    for (const a of audioDevices) {
      body.audioDevices.push({
        name: a.name,
        volume: v,
        muted: m
      });
    }

    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        AudioDevice.setMute(prevMute, audioDevices);
        AudioDevice.setVolume(prevVol, audioDevices);
        ret.emit(false);
      }
    );

    return ret;
  }

  public setMasterVolume(v: number, preset: Preset): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("changing master volume to", v, "for preset", preset);
    const prev = preset.masterVolume;
    preset.masterVolume = v;

    const body = { audioDevices: [] };
    for (const a of preset.audioDevices) {
      const vol = a.mixlevel * (v / 100);
      body.audioDevices.push({
        name: a.name,
        volume: Math.round(vol),
        muted: a.mixmute
      });
    }

    console.log("volume body", body);

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        // post master volume update
        const event = new Event();

        event.User = APIService.piHostname;
        event.EventTags = ["ui-communication"];
        event.AffectedRoom = new BasicRoomInfo(
          APIService.building + "-" + APIService.roomName
        );
        event.TargetDevice = new BasicDeviceInfo(
          APIService.building + "-" + APIService.roomName + "-" + preset.name
        );
        event.Key = "master-volume";
        event.Value = String(v);
        event.Data = preset.name;

        this.api.sendEvent(event);
        this.commandInProgress = false;
        ret.emit(true);
      },
      err => {
        preset.masterVolume = prev;
        ret.emit(false);
        this.commandInProgress = false;
        this.es.show(SetVolume, err);
      }
    );

    return ret;
  }

  public setMasterMute(m: boolean, preset: Preset): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("changing master mute to", m, "for preset", preset);

    const prev = preset.masterMute;
    preset.masterMute = m;

    const body = { audioDevices: [] };
    for (const a of preset.audioDevices) {
      body.audioDevices.push({
        name: a.name,
        muted: a.mixmute || m
      });
    }

    console.log("master mute body", body);

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        const event = new Event();

        event.User = APIService.piHostname;
        event.EventTags = ["ui-communication"];
        event.AffectedRoom = new BasicRoomInfo(
          APIService.building + "-" + APIService.roomName
        );
        event.TargetDevice = new BasicDeviceInfo(
          APIService.building + "-" + APIService.roomName + "-" + preset.name
        );
        event.Key = "master-mute";
        event.Value = String(m);
        event.Data = preset.name;

        this.api.sendEvent(event);
        this.commandInProgress = false;
        ret.emit(true);
      },
      err => {
        preset.masterMute = prev;
        ret.emit(false);
        this.commandInProgress = false;
        this.es.show(MasterMute, err);
      }
    );

    return ret;
  }

  public setMixLevel(
    v: number,
    a: AudioDevice,
    preset: Preset
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("changing mix level to", v, "for audioDevice", a);
    const prev = a.mixlevel;
    a.mixlevel = v;

    const body = { audioDevices: [] };
    const vol = v * (preset.masterVolume / 100);
    body.audioDevices.push({
      name: a.name,
      volume: Math.round(vol)
    });

    console.log("volume body", body);

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        const event = new Event();

        event.User = APIService.piHostname;
        event.EventTags = ["ui-communication"];
        event.AffectedRoom = new BasicRoomInfo(
          APIService.building + "-" + APIService.roomName
        );
        event.TargetDevice = new BasicDeviceInfo(
          APIService.building + "-" + APIService.roomName + "-" + preset.name
        );
        event.Key = "mix-level";
        event.Value = String(v);

        this.api.sendEvent(event);
        this.commandInProgress = false;
        ret.emit(true);
      },
      err => {
        a.mixlevel = prev;
        ret.emit(false);
        this.commandInProgress = false;
        this.es.show(MixLevel, err);
      }
    );

    return ret;
  }

  public setMixMute(
    m: boolean,
    a: AudioDevice,
    preset: Preset
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("changing mix mute to", m, "for audioDevice", a);
    console.log("preset.masterMute is:", preset.masterMute);

    const prev = a.mixmute;
    a.mixmute = m;

    const body = { audioDevices: [] };
    body.audioDevices.push({
      name: a.name,
      muted: m
    });

    console.log("mix mute body:", body);

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        const event = new Event();

        event.User = APIService.piHostname;
        event.EventTags = ["ui-communication"];
        event.AffectedRoom = new BasicRoomInfo(
          APIService.building + "-" + APIService.roomName + "-" + a.name
        );
        event.Key = "mix-mute";
        event.Value = String(m);

        this.api.sendEvent(event);

        this.commandInProgress = false;
        ret.emit(true);
      },
      err => {
        a.mixmute = prev;
        ret.emit(false);
        this.commandInProgress = false;
        this.es.show(MixMute, err);
      }
    );

    return ret;
  }

  public powerOnDefault(preset: Preset): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();

    const body = { displays: [], audioDevices: [] };

    for (const d of preset.displays) {
      body.displays.push({
        name: d.name,
        power: "on",
        input: preset.inputs[0].name,
        blanked: false
      });
    }

    for (const a of preset.audioDevices) {
      body.audioDevices.push({
        name: a.name,
        muted: false,
        volume: 30
      });
    }

    preset.masterMute = false;

    console.log("sending power on default body", body);

    const powerOnReq = new CommandRequest(
      new Request({
        method: "PUT",
        url: APIService.apiurl,
        body: body
      })
    );
    const requests: CommandRequest[] = [powerOnReq];

    if (preset.commands.powerOn != null) {
      for (const cmd of preset.commands.powerOn) {
        requests.push(this.buildRequest(cmd));
      }
    }

    if (preset.commands.inputSame) {
      for (const cmd of preset.commands.inputSame) {
        requests.push(this.buildRequest(cmd));
      }
    }

    this.executeRequests(requests, 10 * 1000).subscribe(answer => {
      const rrMap: Map<Request, Response> = answer as Map<Request, Response>;
      rrMap.forEach((v, k) => {
        if (!v.ok) {
          this.es.show(PowerOn, v);
          ret.emit(false);
          return ret;
        }
      });

      ret.emit(true);
    });

    return ret;
  }

  private executeRequests(
    requests: CommandRequest[],
    timeout: number
  ): EventEmitter<Map<CommandRequest, Response>> {
    const ret = new EventEmitter<Map<CommandRequest, Response>>();
    const mapToResp: Map<CommandRequest, Response> = new Map();
    if (requests.length < 1) {
      setTimeout(() => ret.emit(mapToResp), 250);
      return ret;
    }

    console.info("executing requests: ", requests);
    this.commandInProgress = true;

    const numRequests = requests.length;
    const mapToStatus: Map<CommandRequest, boolean> = new Map();

    for (const req of requests) {
      this.executeRequest(req, timeout).subscribe(resp => {
        mapToResp.set(req, resp);

        if (mapToResp.size === requests.length) {
          console.info(
            "finished all requests, requests => success:",
            mapToResp
          );

          this.commandInProgress = false;

          ret.emit(mapToResp);
        }
      });
    }

    console.log("waiting for", requests.length, "responses...");
    return ret;
  }

  private executeRequest(
    req: CommandRequest,
    timeout: number
  ): EventEmitter<Response> {
    const ret: EventEmitter<Response> = new EventEmitter<Response>();
    console.log("executing request", req);

    setTimeout(() => {
      this.http
        .request(req.req)
        .timeout(timeout)
        .subscribe(
          data => {
            ret.emit(data);
          },
          err => {
            ret.emit(err);
          }
        );
    }, req.delay);

    return ret;
  }

  private buildRequest(cmd: ConfigCommand): CommandRequest {
    // if we needed logic to create a request, it would be right here!!
    return new CommandRequest(
      new Request({
        method: cmd.method,
        url: APIService.apihost + ":" + cmd.port + "/" + cmd.endpoint,
        body: cmd.body
      }),
      cmd.delay
    );
  }

  public powerOff(preset: Preset): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();

    const body = { displays: [], audioDevices: [] };
    for (const d of preset.displays) {
      body.displays.push({
        name: d.name,
        power: "standby",
        input: preset.inputs[0].name
      });
    }

    console.log("sending power off body", body);

    const powerOffReq = new CommandRequest(
      new Request({
        method: "PUT",
        url: APIService.apiurl,
        body: body
      })
    );
    const requests: CommandRequest[] = [powerOffReq];

    if (preset.commands.powerOff != null) {
      for (const cmd of preset.commands.powerOff) {
        requests.push(this.buildRequest(cmd));
      }
    }

    this.commandInProgress = true;
    this.executeRequests(requests, 10 * 1000).subscribe(answer => {
      const rrMap: Map<Request, Response> = answer as Map<Request, Response>;
      rrMap.forEach((v, k) => {
        if (!v.ok) {
          this.es.show(PowerOff, v);
          ret.emit(false);
          this.commandInProgress = false;
          return ret;
        }
      });

      ret.emit(true);
    });

    return ret;
  }

  public powerOffAll(): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();

    const body = { power: "standby" };

    this.commandInProgress = true;
    this.put(body).subscribe(
      data => {
        this.commandInProgress = false;
        ret.emit(true);
      },
      err => {
        this.es.show(PowerOff, err);
        this.commandInProgress = false;
        ret.emit(false);
      }
    );

    return ret;
  }

  /*
  public share(from: Display, to: Display[]): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    if (from.input == null) {
      setTimeout(() => ret.emit(false), 150);
      return ret;
    }

    console.log("sharing to", to, "from", from);

    const body = { displays: [], audioDevices: [] };
    for (const d of to) {
      body.displays.push({
        name: d.name,
        power: "on",
        blanked: false,
        input: from.input.name
      });
    }

    const audioConfigs = this.data.getAudioConfigurations(to);
    const hasRoomWide = this.data.hasRoomWide(audioConfigs);

    if (hasRoomWide) {
      // mute the source device (yourself)
      body.audioDevices.push({
        name: from.name,
        muted: true,
        volume: 0
      });

      for (const config of audioConfigs) {
        for (const audio of config.audioDevices) {
          body.audioDevices.push({
            name: audio.name,
            muted: !config.roomWide,
            volume: config.roomWide ? 30 : 0
          });
        }
      }
    } else {
      // mute everything except for yourself
      for (const config of audioConfigs) {
        for (const audio of config.audioDevices) {
          body.audioDevices.push({
            name: audio.name,
            muted: true,
            volume: 0
          });
        }
      }
    }

    console.log("share body:", body);

    this.putWithCustomTimeout(body, 20 * 1000).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        ret.emit(false);
      }
    );

    return ret;
  }

  public unShare(
    from: Display[],
    fromAudio: AudioConfig[]
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    const body = { displays: [], audioDevices: [] };

    for (const d of from) {
      const preset: Preset = this.data.presets.find(p =>
        p.displays.includes(d)
      );

      if (preset != null) {
        body.displays.push({
          name: d.name,
          power: "on",
          input: preset.inputs[0].name,
          blanked: false
        });
      }
    }

    for (const ac of fromAudio) {
      for (const a of ac.audioDevices) {
        body.audioDevices.push({
          name: a.name,
          volume: 30,
          muted: false
        });
      }
    }

    console.log("unshare body", body);

    this.putWithCustomTimeout(body, 20 * 1000).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        ret.emit(false);
      }
    );

    return ret;
  }

  public mirror(mirror: Preset, on: Preset) {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    const body = { displays: [], audioDevices: [] };

    const power: string = Display.getPower(mirror.displays);
    const input: Input = Display.getInput(mirror.displays);
    const blanked: boolean = Display.getBlank(mirror.displays);

    for (const d of on.displays) {
      body.displays.push({
        name: d.name,
        power: power,
        input: input.name,
        blanked: blanked
      });
    }

    for (const a of on.audioDevices) {
      body.audioDevices.push({
        name: a.name,
        muted: true
      });
    }

    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        ret.emit(false);
      }
    );

    return ret;
  }
     */

  public viaControl(via: Input, endpoint: string): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();

    // get the address of the via
    const config = this.data.getInputConfiguration(via);

    // build the request
    const req = new Request({
      method: "GET",
      url: APIService.apihost + ":8014/via/" + config.address + "/" + endpoint
    });

    // execute request
    console.log("executing via control request:", req);
    this.http.request(req).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        ret.emit(false);
      }
    );

    return ret;
  }

  public buttonPress(value: string, data?: any) {
    const event = new Event();

    event.EventTags = ["ui-event", "cherry-ui"];

    event.AffectedRoom = new BasicRoomInfo(
      APIService.building + "-" + APIService.roomName
    );
    event.TargetDevice = new BasicDeviceInfo(APIService.piHostname);
    event.GeneratingSystem = APIService.piHostname;
    event.Timestamp = new Date();
    event.User = "";
    event.Data = data;

    event.Key = "user-interaction";
    event.Value = value;

    this.api.sendEvent(event);
  }

  public projectorUp(device: DeviceConfiguration): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    const command = device.type.commands.find(one => one._id == "ScreenUp");

    if (!command) {
      ret.emit(false);
      return ret;
    }

    const path = command.endpoint.path.replace(":address", device.address);
    let fullpath = command.microservice.address + path;
    fullpath = fullpath.replace("localhost", window.location.hostname);


    const projectorUpReq = new CommandRequest(
      new Request({
        method: "GET",
        url: fullpath,
      })
    );

    this.executeRequest(projectorUpReq, 20 * 1000).subscribe(success => {
      ret.emit(success);
    });

    return ret;
  }

  public projectorStop(device: DeviceConfiguration): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    const command = device.type.commands.find(one => one._id == "ScreenStop");

    if (!command) {
      ret.emit(false);
      return ret;
    }

    const path = command.endpoint.path.replace(":address", device.address);
    let fullpath = command.microservice.address + path;
    fullpath = fullpath.replace("localhost", window.location.hostname);


    const projectorStopReq = new CommandRequest(
      new Request({
        method: "GET",
        url: fullpath,
      })
    );

    this.executeRequest(projectorStopReq, 20 * 1000).subscribe(success => {
      ret.emit(success);
    });

    return ret;
  }

  public projectorDown(device: DeviceConfiguration): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    const command = device.type.commands.find(one => one._id == "ScreenDown");

    if (!command) {
      ret.emit(false);
      return ret;
    }

    const path = command.endpoint.path.replace(":address", device.address);
    let fullpath = command.microservice.address + path;
    fullpath = fullpath.replace("localhost", window.location.hostname);


    const projectorDownReq = new CommandRequest(
      new Request({
        method: "GET",
        url: fullpath,
      })
    );

    this.executeRequest(projectorDownReq, 20 * 1000).subscribe(success => {
      ret.emit(success);
    });

    return ret;
  }
}
