import { Component, OnInit, Input as AngularInput } from '@angular/core';
import { ControlGroup, AudioDevice, AudioGroup, Input } from 'src/app/objects/control';
import { BFFService } from 'src/app/services/bff.service';
import { IControlTab } from '../control-tab/icontrol-tab';

@Component({
  selector: 'app-audio',
  templateUrl: './audio.component.html',
  styleUrls: ['./audio.component.scss']
})
export class AudioComponent implements OnInit, IControlTab {
  @AngularInput() cg: ControlGroup = new ControlGroup();

  constructor(private bff: BFFService) {
    
  }

  ngOnInit() {
  }

  setVolume = (level: number, device: any) => {
    const audioDevice = device as AudioDevice;
    this.bff.setVolume(this.cg, level, audioDevice.id);
  }

  setMute = (muted: boolean, device: any) => {
    const audioDevice = device as AudioDevice;
    this.bff.setMute(this.cg, muted, audioDevice.id);
  }

  muteAll = (ag: AudioGroup) => {
    let muteState = true;
    if (ag.allAreMuted()) {
      muteState = false;
    }

    for (const ad of ag.audioDevices) {
      this.bff.setMute(this.cg, muteState, ad.id);
    }
  }
}
