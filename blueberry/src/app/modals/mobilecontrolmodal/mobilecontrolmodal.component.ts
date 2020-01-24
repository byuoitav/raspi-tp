import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";
import { APIService } from "../../services/api.service";
import { CommandService } from "../../services/command.service";
import { DataService } from 'app/services/data.service';

@Component({
  selector: 'app-mobilecontrolmodal',
  templateUrl: './mobilecontrolmodal.component.html',
  styleUrls: ['./mobilecontrolmodal.component.scss']
})
export class MobileControlModal implements OnInit {
  public qrcode: string;
  public elementType: 'url';

  constructor(
    public ref: MatDialogRef<MobileControlModal>,
    public data: DataService,
    public dialog: MatDialog,
    public api: APIService,
    public command: CommandService,
  ) {
    this.qrcode = data.roomControlUrl + "/key/" + data.controlKey;
   }

  ngOnInit() {
    this.ref.disableClose = true;    
  }

  public cancel() {
    this.command.buttonPress("exit mobile control modal")
    this.ref.close();
  }
}
