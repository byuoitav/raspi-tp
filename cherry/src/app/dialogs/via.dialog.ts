import { Component, Inject } from "@angular/core";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";

import { CommandService } from "../services/command.service";
import { ConfirmHelpDialog } from "./confirmhelp.dialog";

@Component({
  selector: "help",
  template: `
        <h1 mat-dialog-title class="text">VIA Control</h1>

        <div mat-dialog-actions class="items">
            <button mat-raised-button
                color="primary"
                (click)="cancel(); command.buttonPress('exit via control modal', this.data['via']?.name)">
                Cancel
            </button>
            <div class="secondary-theme">
                <button mat-raised-button
                    color="warn"
                    (click)="viaControl('reset'); command.buttonPress('reset via', this.data['via']?.name)">
                    Reset
                </button>
            </div>
            <button mat-raised-button
                color="warn"
                (click)="viaControl('reboot'); command.buttonPress('reboot via', this.data['via']?.name)">
                Reboot
                </button>
        </div>
    `,
  styles: [
    `
      .text {
        text-align: center;
        font-family: Roboto, "Helvetica Neue", sans-serif;
      }

      .items {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items: center;
      }
    `
  ]
})
export class ViaDialog {
  constructor(
    public dialogRef: MatDialogRef<ViaDialog>,
    public command: CommandService,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialog: MatDialog
  ) {
    if (this.data == null || this.data["via"] == null) {
      this.fail();
    }
  }

  public viaControl(endpoint: string) {
    this.command.viaControl(this.data["via"], endpoint).subscribe(success => {
      if (success) {
        this.dialogRef.close();
      }
    });
  }

  public cancel() {
    this.dialogRef.close();
  }

  private fail() {
    console.error(
      "must include data, with field 'via', which is an Input. data passed in to ViaDialog:",
      this.data
    );
    this.dialogRef.close();
  }
}
