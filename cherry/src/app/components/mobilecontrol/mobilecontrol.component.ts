import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";
import { APIService } from "../../services/api.service";
import { CommandService } from "../../services/command.service";
import { DataService } from 'app/services/data.service';

@Component({
  selector: 'mobile-control',
  templateUrl: './mobilecontrol.component.html',
  styleUrls: ['./mobilecontrol.component.scss']
})
export class MobileControlComponent implements OnInit {
  public value: string;
  public elementType: 'url';

  constructor(
    public ref: MatDialogRef<MobileControlComponent>,
    public data: DataService,
    public dialog: MatDialog,
    public api: APIService,
    public command: CommandService,
  ) {
    this.value = data.roomControlUrl + "/key/" + data.controlKey;
   }

  ngOnInit() {
    this.ref.disableClose = true;    
  }

  public cancel() {
    this.command.buttonPress("exit mobile control")
    this.ref.close();
  }
}
