import { Injectable, EventEmitter } from "@angular/core";
import { Http } from "@angular/http";

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
  VOLUME,
  MUTED
} from "../objects/status.objects";

const PRESET_SWITCH = "preset-switch";

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

  public dividerSensor: DeviceConfiguration;

  constructor(
    private api: APIService,
    private socket: SocketService,
    private http: Http
  ) {
    this.loaded = new EventEmitter<boolean>();

    this.api.loaded.subscribe(() => {
      this.createInputs();
      this.createOutputs();
      this.createPseudoInputs();

      this.createPresets();
      this.createPanels();

      // set divider sensor
      this.dividerSensor = APIService.room.config.devices.find(d =>
        d.hasRole("DividerSensor")
      );
      if (this.dividerSensor != null) {
        console.log("dividerSensor: ", this.dividerSensor);
        this.setCurrentPreset();
      }

      this.update();
      this.loaded.emit(true);
    });
  }

  private createInputs() {
    // create real inputs
    APIService.room.config.devices
      .filter(device => device.hasRole("VideoIn") || device.hasRole("AudioIn"))
      .forEach(input => {
        const inputConfiguration = APIService.room.uiconfig.inputConfiguration.find(
          i => i.name === input.name
        );
        if (inputConfiguration != null) {
          const i = new Input(
            input.name,
            input.display_name,
            inputConfiguration.icon
          );
          this.inputs.push(i);
        } else {
          console.warn("No input configuration found for:", input.name);
        }
      });

    console.info("Inputs", this.inputs);
  }

  private createOutputs() {
    // create displays
    if (APIService.room.uiconfig.outputConfiguration == null) {
      console.warn(
        "missing output configuration. this will probably cause problems on cherry."
      );
    }

    if (APIService.room.status.displays != null) {
      for (const status of APIService.room.status.displays) {
        const config = APIService.room.config.devices.find(
          d => d.name === status.name
        );
        const deviceConfig = APIService.room.uiconfig.outputConfiguration.find(
          d => d.name === status.name
        );

        if (config != null) {
          if (deviceConfig != null) {
            const d = new Display(
              status.name,
              config.display_name,
              status.power,
              Input.getInput(status.input, this.inputs),
              status.blanked,
              deviceConfig.icon
            );
            this.displays.push(d);
          } else {
            console.warn(
              "No device configuration found for this display: ",
              status.name
            );
          }
        } else {
          console.warn("No configuration found for this display:", status.name);
        }
      }
    }

    console.info("Displays", this.displays);

    // create audioDevices
    if (APIService.room.status.audioDevices != null) {
      for (const status of APIService.room.status.audioDevices) {
        const config = APIService.room.config.devices.find(
          d => d.name === status.name
        );
        const deviceConfig = APIService.room.uiconfig.outputConfiguration.find(
          d => d.name === status.name
        );

        if (config != null) {
          if (deviceConfig != null) {
            const a = new AudioDevice(
              status.name,
              config.display_name,
              status.power,
              Input.getInput(status.input, this.inputs),
              status.muted,
              status.volume,
              deviceConfig.icon,
              config.type._id,
              100
            );
            this.audioDevices.push(a);
          } else {
            console.warn(
              "No output configuration for this audio device (check the ui config): ",
              status.name
            );
          }
        } else {
          console.warn(
            "No configuration found for this audio device:",
            status.name
          );
        }
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
        if (preset.audioDevices == null) {
          console.warn("no audio devices found for preset", preset.name);
          continue;
        }

        const audioDevices = this.audioDevices.filter(a =>
          preset.audioDevices.includes(a.name)
        );

        for (const display of preset.displays) {
          const disp: Display = this.displays.find(d => d.name === display);

          if (!this.audioConfig.has(disp)) {
            this.audioConfig.set(
              disp,
              new AudioConfig(disp, audioDevices, false)
            );
          }
        }
      }

      console.log("AudioConfig", this.audioConfig);
    } else {
      console.warn("No AudioConfig present.");
    }
  }

  private createPseudoInputs() {
    // create pseudo inputs
    if (APIService.room.uiconfig.pseudoInputs == null) {
      return;
    }

    for (const pi of APIService.room.uiconfig.pseudoInputs) {
      console.log("pseudo input:", pi);
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
      const audioTypes = new Map<string, AudioDevice[]>();
      independentAudioDevices.forEach(a => {
        audioTypes.set(a.type, audioTypes.get(a.type) || []);
        audioTypes.get(a.type).push(a);
      });

      const p = new Preset(
        preset.name,
        preset.icon,
        displays,
        audioDevices,
        inputs,
        preset.shareableDisplays,
        independentAudioDevices,
        audioTypes,
        30,
        30,
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

  private setCurrentPreset() {
    if (!this.panel.features.includes(PRESET_SWITCH)) {
      return;
    }

    this.http
      .get(
        "http://" +
          this.dividerSensor.address +
          ":8200/preset/" +
          APIService.piHostname
      )
      .map(res => res.json())
      .subscribe(
        data => {
          const preset = this.presets.find(
            p => p.name.toLowerCase() === data.toLowerCase()
          );

          if (preset != null) {
            console.log("setting initial preset to", preset);
            this.panel.preset = preset;
          } else {
            console.error(
              "current preset response doesn't exist. response: ",
              data
            );
          }
        },
        err => {
          console.log(
            "failed to get intial preset from divider sensor, trying again..."
          );
          setTimeout(this.setCurrentPreset, 5000);
        }
      );
  }

  private update() {
    this.socket.getEventListener().subscribe(event => {
      if (event.type === MESSAGE) {
        const e = event.data;

        let split: string[] = [];
        if (e.TargetDevice.DeviceID.length > 0) {
          split = e.TargetDevice.DeviceID.split("-");
        }

        if (e.Key.length > 0 && e.Value.length > 0 && split.length === 3) {
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
            case "master-volume": {
              const presetToChange = this.presets.find(
                p => p.name === split[2]
              );
              if (presetToChange != null) {
                presetToChange.masterVolume = parseInt(e.Value, 10);
              }
              break;
            }
            case "mix-level": {
              const audioDevice = this.audioDevices.find(
                a => a.name === split[2]
              );

              if (audioDevice != null) {
                audioDevice.mixlevel = parseInt(e.Value, 10);
              }
              break;
            }
            case PRESET_SWITCH:
              // switch presets
              if (
                APIService.piHostname.toLowerCase() !== split[2].toLowerCase()
              ) {
                break;
              }

              const presetName = e.Value.toLowerCase();
              const preset = this.presets.find(
                p => p.name.toLowerCase() === presetName
              );

              if (preset != null) {
                console.log("switching preset to: ", preset);
                this.panel.preset = preset;
              }
              break;
            default:
              break;
          }
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
