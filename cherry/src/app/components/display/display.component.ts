import { Component, Input as AngularInput } from "@angular/core";
import { MatDialog } from "@angular/material";

import { DataService } from "../../services/data.service";
import { CommandService } from "../../services/command.service";
import { ViaDialog } from "../../dialogs/via.dialog";

import { Preset } from "../../objects/objects";
import { Display, AudioDevice, Input } from "../../objects/status.objects";

@Component({
  selector: "display",
  templateUrl: "./display.component.html",
  styleUrls: ["./display.component.scss"]
})
export class DisplayComponent {
  @AngularInput() preset: Preset;

  selectedDisplays: Set<Display> = new Set();

  constructor(
    private data: DataService,
    public command: CommandService,
    private dialog: MatDialog
  ) {
    // default to the first display being selected
    setTimeout(() => {
      if (this.preset.displays.length > 0) {
        this.selectedDisplays.add(this.preset.displays[0]);
      }
    }, 0);
  }

  public toggleDisplay(d: Display) {
    this.selectedDisplays.clear();
    this.selectedDisplays.add(d);

    /* This code makes it so that the displays toggle
        if (this.selectedDisplays.has(d))
            this.selectedDisplays.delete(d);
        else
            this.selectedDisplays.add(d);
        */
  }

  public changeInput(i: Input) {
    this.command
      .setInput(i, Array.from(this.selectedDisplays))
      .subscribe(success => {
        if (!success) {
          console.warn("failed to change input");
        }
      });
  }

  public blank() {
    this.command
      .setBlank(true, Array.from(this.selectedDisplays))
      .subscribe(success => {
        if (!success) {
          console.warn("failed to blank");
        }
      });
  }

  public setMasterMute(muted) {
    if (muted) {
      this.preset.beforeMuteLevel = this.preset.masterVolume;
      this.command.setMasterVolume(0, this.preset);
    } else {
      this.command.setMasterVolume(this.preset.beforeMuteLevel, this.preset);
    }
  }

  public inputUsed(i: Input): boolean {
    const selected = Array.from(this.selectedDisplays);

    for (const d of selected) {
      // because blank is treated like an input
      if (d.blanked || d.input == null) {
        continue;
      }

      if (d.input.name === i.name) {
        return true;
      }
    }

    return false;
  }

  public isOneBlanked(): boolean {
    const selected = Array.from(this.selectedDisplays);

    for (const d of selected) {
      if (d.blanked) {
        return true;
      }
    }

    return false;
  }

  public openInputDialog(i: Input) {
    const config = this.data.getInputConfiguration(i);

    switch (config.type._id) {
      case "via-connect-pro":
        console.log("opening via control dialog for", i);
        const dialogRef = this.dialog.open(ViaDialog, {
          width: "50vw",
          data: { via: i }
        });
        break;
      default:
        console.log("nothing to do for type", config.type._id);
        break;
    }
  }

  public getSelectedDisplayNames(): string[] {
    const displays: string[] = [];
    this.selectedDisplays.forEach(d => {
      displays.push(d.name);
    });

    return displays;
  }
}
