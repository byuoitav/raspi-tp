import { Injectable, EventEmitter, ViewChild, ElementRef } from "@angular/core";
import {
  Http,
  Response,
  Headers,
  RequestOptions,
  Request
} from "@angular/http";
import { Observable } from "rxjs/Rx";
import { MatSliderChange } from "@angular/material";

import { APIService } from "./api.service";
import { DataService } from "./data.service";
import { Event, BasicDeviceInfo, BasicRoomInfo } from "./socket.service";
import { Input, Display, AudioDevice } from "../objects/status.objects";
import { Preset, AudioConfig, ConfigCommand } from "../objects/objects";

import "rxjs/add/operator/map";
import "rxjs/add/operator/timeout";
import { deserialize } from "serializer.ts/Serializer";

const TIMEOUT = 12 * 1000;

@Injectable()
export class CommandService {
  private options: RequestOptions;

  constructor(
    private http: Http,
    private data: DataService,
    public api: APIService
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
      }
    );

    return ret;
  }

  public setInput(i: Input, displays: Display[]): EventEmitter<boolean> {
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

    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        Display.setInput(prev, displays);
        Display.setBlank(prevBlank, displays);

        ret.emit(false);
      }
    );

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

    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        Display.setBlank(prev, displays);
        ret.emit(false);
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

    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        AudioDevice.setVolume(prev, audioDevices);
        ret.emit(false);
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

    this.put(body).subscribe(
      data => {
        ret.emit(true);
      },
      err => {
        AudioDevice.setMute(prev, audioDevices);
        ret.emit(false);
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
        muted: vol === 0
      });
    }

    console.log("volume body", body);

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

        this.api.sendEvent(event);
        ret.emit(true);
      },
      err => {
        preset.masterVolume = prev;
        ret.emit(false);
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
      volume: Math.round(vol),
      muted: vol === 0
    });

    console.log("volume body", body);

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
        ret.emit(true);
      },
      err => {
        a.mixlevel = prev;
        ret.emit(false);
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

    console.log("sending power on default body", body);

    const powerOnReq = new Request({
      method: "PUT",
      url: APIService.apiurl,
      body: body
    });
    const requests: Request[] = [powerOnReq];

    if (preset.commands.powerOn != null) {
      for (const cmd of preset.commands.powerOn) {
        requests.push(this.buildRequest(cmd));
      }
    }

    this.executeRequests(requests, 1, 20 * 1000).subscribe(success => {
      ret.emit(success);
    });
    return ret;
  }

  private executeRequests(
    requests: Request[],
    maxTries: number,
    timeout: number
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    if (requests.length < 1) {
      setTimeout(() => ret.emit(false), 250);
      return ret;
    }

    console.info("executing requests: ", requests);
    const numRequests = requests.length;
    const mapToStatus: Map<Request, boolean> = new Map();

    for (const req of requests) {
      this.executeRequest(req, maxTries, timeout).subscribe(success => {
        mapToStatus.set(req, success);

        if (mapToStatus.size === numRequests) {
          console.info(
            "finished all requests, requests => success:",
            mapToStatus
          );

          let allsuccessful = true;
          mapToStatus.forEach((v, k) => {
            if (!v) {
              allsuccessful = false;
            }
          });

          ret.emit(allsuccessful);
          return;
        }
      });
    }

    console.log("waiting for", requests.length, "responses...");

    return ret;
  }

  private executeRequest(
    req: Request,
    maxTries: number,
    timeout: number
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();
    console.log("executing request", req);

    this.http
      .request(req)
      .timeout(timeout)
      .subscribe(
        data => {
          console.log("successfully executed request", req);
          ret.emit(true);
          return;
        },
        err => {
          maxTries--;

          if (maxTries === 0) {
            ret.emit(false);
            return;
          }

          // retry request
          console.error(
            "request (" + req + ") failed. error:",
            err,
            ". There are",
            maxTries,
            " remaining, retrying in 3 seconds..."
          );
          setTimeout(() => this.executeRequest(req, maxTries, timeout), 3000);
        }
      );

    return ret;
  }

  private buildRequest(cmd: ConfigCommand): Request {
    return new Request({
      method: cmd.method,
      url: APIService.apihost + ":" + cmd.port + "/" + cmd.endpoint,
      body: cmd.body
    });
  }

  public powerOff(preset: Preset): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();

    const body = { displays: [], audioDevices: [] };
    for (const d of preset.displays) {
      body.displays.push({
        name: d.name,
        power: "standby"
      });
    }

    console.log("sending power off body", body);

    const powerOffReq = new Request({
      method: "PUT",
      url: APIService.apiurl,
      body: body
    });
    const requests: Request[] = [powerOffReq];

    if (preset.commands.powerOff != null) {
      for (const cmd of preset.commands.powerOff) {
        requests.push(this.buildRequest(cmd));
      }
    }

    this.executeRequests(requests, 1, 20 * 1000).subscribe(success => {
      ret.emit(success);
    });

    return ret;
  }

  public powerOffAll(): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter<boolean>();

    const body = { power: "standby" };

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
}
