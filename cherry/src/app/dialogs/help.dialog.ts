import { Component, Inject } from "@angular/core";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";

import { APIService } from "../services/api.service";
import { CommandService } from "../services/command.service";
import { ConfirmHelpDialog } from "./confirmhelp.dialog";

@Component({
  selector: "help",
  template: `
        <h1 mat-dialog-title class="text">Help</h1>

        <div mat-dialog-content class="text">
            <p *ngIf="!isAfterHours()">
              Please call AV Support at 801-422-7671 for help, or request help by pressing <i>Request Help</i> to send support staff to you.
            </p>
            <p *ngIf="isAfterHours()">
              No technicians are currently available. For emergencies please call 801-422-7671.
            </p>
        </div>

        <div mat-dialog-actions class="items secondary-theme">
            <button mat-raised-button
                color="warn"
                (click)="cancel(); command.buttonPress('exit help modal')">Cancel
            </button>
            <button mat-raised-button
                *ngIf="!isAfterHours()"
                color="primary"
                (click)="requestHelp(); command.buttonPress('request help')">Request Help
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
        justify-content: center;
        align-items: center;
      }
    `
  ]
})
export class HelpDialog {
  constructor(
    public dialogRef: MatDialogRef<HelpDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialog: MatDialog,
    public api: APIService,
    public command: CommandService,
  ) {}

  public requestHelp() {
    this.api.help("help").subscribe(success => {
      if (success) {
        const dialogRef = this.dialog.open(ConfirmHelpDialog, {
          width: "70vw"
        });

        this.dialogRef.close();
      } else {
        console.error("failed to request help");
      }
    });
  }

  public cancel() {
    this.dialogRef.close();
  }

  public isAfterHours(): boolean {
    let date = new Date();
    let DayOfTheWeek = date.getDay();
    let CurrentHour = date.getHours();

    switch(DayOfTheWeek) {
      // Sunday
      case 0: { return true; }
      // Monday
      case 1: {
        if(CurrentHour < 7 || CurrentHour >= 19) { return true; }
        else { return false; }
      }
      // Tuesday
      case 2: {
        if(CurrentHour < 7 || CurrentHour >= 21) { return true; }
        else { return false; }
      }
      // Wednesday
      case 3: {
        if(CurrentHour < 7 || CurrentHour >= 21) { return true; }
        else { return false; }
      }
      // Thursday
      case 4: {
        if(CurrentHour < 7 || CurrentHour >= 21) { return true; }
        else { return false; }
      }
      // Friday
      case 5: {
        if(CurrentHour < 7 || CurrentHour >= 20) { return true; }
        else { return false; }
      }
      // Saturday
      case 6: {
        if(CurrentHour < 8 || CurrentHour >= 12) { return true; }
        else { return false; }
      }
      default: { return false; }
    }
  }
}
