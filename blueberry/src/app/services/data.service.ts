import { Injectable, EventEmitter } from "@angular/core";

import { APIService } from "./api.service";
import { SocketService, MESSAGE, Event } from "./socket.service";
import {
  Preset,
  Panel,
  AudioConfig,
  DeviceConfiguration
} from "../objects/objects";
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

@Injectable()
export class DataService {
  public loaded: EventEmitter<boolean>;

  public panel: Panel;
  public inputs: Input[] = [];
  public displays: Display[] = [];
  public audioDevices: AudioDevice[] = [];
  public audioConfig: Map<Display, AudioConfig> = new Map();
  public presets: Preset[] = [];
  public panels: Panel[] = [];

  constructor(private api: APIService, private socket: SocketService) {
    this.loaded = new EventEmitter<boolean>();

    this.api.loaded.subscribe(() => {
      this.createInputs();
      this.createOutputs();

      this.createPresets();
      this.createPanels();

      this.update();

      this.loaded.emit(true);
    });
  }

  private createInputs() {
    for (const config of APIService.room.uiconfig.inputConfiguration) {
      const name = config.name.split("|")[0];
      const input = APIService.room.config.devices.find(i => i.name === name);

      if (input && input.hasRole("VideoIn")) {
        const reachability = APIService.room.config.input_reachability[name];

        if (!reachability) {
          console.warn("no displays are reachable from input", name);
          continue;
        }

        const dispname = config.displayname
          ? config.displayname
          : input.display_name;

        const subs: Input[] = [];
        console.log("does the input have subInputs?", config);
        if (config.subInputs !== undefined) {
          for (const io of config.subInputs) {
            subs.push(new Input(io.name, io.displayname, io.icon, reachability, []))
          }
        }

        this.inputs.push(
          new Input(config.name, dispname, config.icon, reachability, subs)
        );
      } else {
        console.warn(
          "no input '" + name + "' found with role 'VideoIn', skipping it"
        );
      }
    }

    console.info("Inputs", this.inputs);
  }

  private createOutputs() {
    // create displays
    for (const status of APIService.room.status.displays) {
      const config = APIService.room.config.devices.find(
        d => d.name === status.name
      );

      if (config != null) {
        const d = new Display(
          status.name,
          config.display_name,
          status.power,
          Input.getInput(status.input, this.inputs),
          status.blanked
        );
        this.displays.push(d);
      } else {
        console.warn("No configuration found for this display:", status);
      }
    }

    console.info("Displays", this.displays);

    // create audioDevices
    for (const status of APIService.room.status.audioDevices) {
      const config = APIService.room.config.devices.find(
        d => d.name === status.name
      );

      if (config != null) {
        const a = new AudioDevice(
          status.name,
          config.display_name,
          status.power,
          Input.getInput(status.input, this.inputs),
          status.muted,
          status.volume
        );
        this.audioDevices.push(a);
      } else {
        console.warn("No configuration found for this audio device:", status);
      }
    }

    console.info("AudioDevices", this.audioDevices);

    // create room wide audio map
    if (APIService.room.uiconfig.audioConfiguration != null) {
      for (const config of APIService.room.uiconfig.audioConfiguration) {
        // get display
        const display = this.displays.find(d => d.name === config.display);
        const audioDevices = this.audioDevices.filter(a =>
          config.audioDevices.includes(a.name)
        );

        this.audioConfig.set(
          display,
          new AudioConfig(display, audioDevices, config.roomWide)
        );
      }

      // fill out rest of audio config
      for (const preset of APIService.room.uiconfig.presets) {
        const audioDevices = this.audioDevices.filter(a =>
          preset.audioDevices.includes(a.name)
        );

        for (const display of preset.displays) {
          const d: Display = this.displays.find(dd => dd.name === display);

          if (!this.audioConfig.has(d)) {
            this.audioConfig.set(d, new AudioConfig(d, audioDevices, false));
          }
        }
      }

      console.log("AudioConfig", this.audioConfig);
    } else {
      console.warn("No AudioConfig present.");
    }
  }

  private createPresets() {
    for (const preset of APIService.room.uiconfig.presets) {
      const displays = Device.filterDevices<Display>(
        preset.displays,
        this.displays
      );
      const audioDevices = Device.filterDevices<AudioDevice>(
        preset.audioDevices,
        this.audioDevices
      );
      const inputs = Device.filterDevices<Input>(preset.inputs, this.inputs);
      const independentAudioDevices = Device.filterDevices<AudioDevice>(
        preset.independentAudioDevices,
        this.audioDevices
      );

      // if (preset.screens === undefined) {
      //   preset.screens = ["SCR1"];
      // }
      const screens = APIService.room.config.devices.filter(oneDevice => preset.screens.some(one => one == oneDevice.name));
      console.info("Screens", screens)

      const p = new Preset(
        preset.name,
        preset.icon,
        displays,
        audioDevices,
        inputs,
        screens,
        preset.shareablePresets,
        independentAudioDevices,
        preset.commands
      );
      this.presets.push(p);
    }

    console.info("Presets", this.presets);
  }

  private createPanels() {
    for (const panel of APIService.room.uiconfig.panels) {
      const preset = this.presets.find(p => p.name === panel.preset);

      this.panels.push(
        new Panel(panel.hostname, panel.uipath, preset, panel.features)
      );
    }

    console.info("Panels", this.panels);

    this.panel = this.panels.find(p => p.hostname === APIService.piHostname);
    this.panel.render = true;

    console.info("Panel", this.panel);
  }

  private update() {
    this.socket.getEventListener().subscribe(event => {
      if (event.type === MESSAGE) {
        const e = event.data;

        let split: string[] = [];
        if (e.TargetDevice != null && e.TargetDevice !== undefined) {
          split = e.TargetDevice.DeviceID.split("-");
        }

        if (e.Value.length > 0 && split.length === 3) {
          switch (e.Key) {
            case POWER: {
              let output: Output;
              output = this.displays.find(d => d.name === split[2]);
              if (output != null) {
                output.power = e.Value;
              }

              output = this.audioDevices.find(a => a.name === split[2]);
              if (output != null) {
                output.power = e.Value;
              }

              break;
            }
            case INPUT: {
              let output: Output;
              output = this.displays.find(d => d.name === split[2]);
              if (output != null) {
                output.input = Input.getInput(e.Value, this.inputs);
              }

              output = this.audioDevices.find(a => a.name === split[2]);
              if (output != null) {
                output.input = Input.getInput(e.Value, this.inputs);
              }

              break;
            }
            case BLANKED: {
              const display = this.displays.find(d => d.name === split[2]);

              if (display != null) {
                display.blanked = e.Value.toLowerCase() === "true";
              }
              break;
            }
            case MUTED: {
              const audioDevice = this.audioDevices.find(
                a => a.name === split[2]
              );

              if (audioDevice != null) {
                audioDevice.muted = e.Value.toLowerCase() === "true";
              }
              break;
            }
            case VOLUME: {
              const audioDevice = this.audioDevices.find(
                a => a.name === split[2]
              );

              if (audioDevice != null) {
                audioDevice.volume = parseInt(e.Value, 10);
              }
              break;
            }
            default:
              break;
          }
        } else {
          console.warn("<data service> invalid event", e);
        }
      }
    });
  }

  public getAudioConfigurations(displays: Display[]): AudioConfig[] {
    const audioConfigs: AudioConfig[] = [];

    for (const display of displays) {
      const config = this.audioConfig.get(display);

      if (config != null) {
        audioConfigs.push(config);
      }
    }

    return audioConfigs;
  }

  public hasRoomWide(audioConfigs: AudioConfig[]): boolean {
    for (const config of audioConfigs) {
      if (config.roomWide) {
        return true;
      }
    }

    return false;
  }

  public getInputConfiguration(input: Input): DeviceConfiguration {
    for (const device of APIService.room.config.devices) {
      if (device.name === input.name) {
        return device;
      }
    }
  }
}
