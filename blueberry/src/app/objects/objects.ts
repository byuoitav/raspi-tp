import { Type } from "serializer.ts/Decorators";
import { Device, Display, AudioDevice, Input } from "./status.objects";

export class Room {
  config: RoomConfiguration;
  status: RoomStatus;
  uiconfig: UIConfiguration;
}

export class RoomConfiguration {
  _id: string;
  name: string;
  description: string;

  @Type(() => DeviceConfiguration)
  devices: DeviceConfiguration[];

  input_reachability: Map<string, string[]> = new Map<string, string[]>();

  match(n: string) {
    return n === this.name;
  }
}

export class DeviceConfiguration {
  _id: string;
  name: string;
  display_name: string;
  address: string;

  @Type(() => DeviceTypeConfiguration)
  type: DeviceTypeConfiguration;

  @Type(() => RoleConfiguration)
  roles: RoleConfiguration[];

  public hasRole(role: string): boolean {
    for (const r of this.roles) {
      if (r._id === role) {
        return true;
      }
    }
    return false;
  }
}

export class DeviceTypeConfiguration {
  _id: string;
  description: string;
  tags: string[];
  commands: DeviceTypeCommandConfiguration[];
}

export class DeviceTypeCommandConfiguration {
  _id: string;
  description: string;
  microservice: DeviceTypeCommandMicroserviceConfiguration;
  endpoint: DeviceTypeCommandEndpointConfiguration;
  priority: number;
}

export class DeviceTypeCommandMicroserviceConfiguration {
  _id: string;
  description: string;  
  address: string;
}

export class DeviceTypeCommandEndpointConfiguration {
  _id: string;
  description: string;  
  path: string;
}

export class RoleConfiguration {
  _id: string;
  description: string;
  tags: string[];
}

export class RoomStatus {
  @Type(() => DeviceStatus)
  displays: DeviceStatus[];

  @Type(() => DeviceStatus)
  audioDevices: DeviceStatus[];
}

export class UIConfiguration {
  @Type(() => PanelConfiguration)
  panels: PanelConfiguration[];

  @Type(() => PresetConfiguration)
  presets: PresetConfiguration[];

  @Type(() => InputConfiguration)
  inputConfiguration: InputConfiguration[];

  @Type(() => AudioConfiguration)
  audioConfiguration: AudioConfiguration[];

  Api: string[];
}

export class ConfigCommands {
  powerOn: ConfigCommand[];
  powerOff: ConfigCommand[];
}

export class ConfigCommand {
  method: string;
  port: number;
  endpoint: string;
  body: Object;
  delay: number;
}

export class PanelConfiguration {
  hostname: string;
  uipath: string;
  features: string[];
  preset: string;
}

export class PresetConfiguration {
  name: string;
  icon: string;
  displays: string[];
  shareablePresets: string[];
  audioDevices: string[];
  inputs: string[];
  screens: string[];
  independentAudioDevices: string[];
  commands: ConfigCommands;
}

export class AudioConfiguration {
  display: string;
  audioDevices: string[];
  roomWide: boolean;
}

export class AudioConfig {
  display: Display;
  audioDevices: AudioDevice[];
  roomWide: boolean;

  constructor(
    display: Display,
    audioDevices: AudioDevice[],
    roomWide: boolean
  ) {
    this.display = display;
    this.audioDevices = audioDevices;
    this.roomWide = roomWide;
  }
}

export class InputConfiguration {
  name: string;
  icon: string;
  displayname: string;
  subInputs: InputConfiguration[];
}

export class DeviceStatus {
  name: string;
  power: string;
  input: string;
  blanked: boolean;
  muted: boolean;
  volume: number;

  match(n: string) {
    return n === this.name;
  }
}

export class Preset {
  name: string;
  icon: string;

  displays: Display[] = [];
  audioDevices: AudioDevice[] = [];
  inputs: Input[] = [];
  extraInputs: Input[] = [];
  screens: DeviceConfiguration[];

  shareablePresets: string[];
  independentAudioDevices: AudioDevice[] = [];

  commands: ConfigCommands;

  constructor(
    name: string,
    icon: string,
    displays: Display[],
    audioDevices: AudioDevice[],
    inputs: Input[],
    screens: DeviceConfiguration[],
    shareablePresets: string[],
    independentAudioDevices: AudioDevice[],
    commands: ConfigCommands
  ) {
    this.name = name;
    this.icon = icon;
    this.displays = displays;
    this.audioDevices = audioDevices;
    this.inputs = inputs;
    this.screens = screens;
    this.shareablePresets = shareablePresets;
    this.independentAudioDevices = independentAudioDevices;
    this.commands = commands;
  }
}

export class Panel {
  hostname: string;
  uipath: string;
  preset: Preset;
  features: string[] = [];

  render = false;

  constructor(
    hostname: string,
    uipath: string,
    preset: Preset,
    features: string[]
  ) {
    this.hostname = hostname;
    this.uipath = uipath;
    this.preset = preset;
    this.features = features;
  }
}

export class ErrorMessage {
  title: string;
  body: string;
}
