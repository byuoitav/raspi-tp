import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { HttpModule } from "@angular/http";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import {
  MatTabsModule,
  MatSliderModule,
  MatButtonModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatDialogModule,
  MatIconModule,
  MatDividerModule
} from "@angular/material";
import "hammerjs";

import { AppComponent } from "./components/app.component";
import { DisplayComponent } from "./components/display/display.component";
import { VolumeComponent } from "./components/volume/volume.component";
import { AudiocontrolComponent } from "./components/audiocontrol/audiocontrol.component";

import { HelpDialog } from "./dialogs/help.dialog";
import { ConfirmHelpDialog } from "./dialogs/confirmhelp.dialog";
import { ViaDialog } from "./dialogs/via.dialog";
import { ErrorDialogComponent } from "./dialogs/error/error.component";

import { APIService } from "./services/api.service";
import { CommandService } from "./services/command.service";
import { DataService } from "./services/data.service";
import { GraphService } from "./services/graph.service";
import { SocketService } from "./services/socket.service";
import { ErrorService } from "./services/error.service";
import { ManagementComponent } from "./components/management/management.component";
import { StreamModalComponent } from "./dialogs/streammodal/streammodal.component";
import { ProjectorControlComponent } from "./components/projectorcontrol/projectorcontrol.component";

@NgModule({
  declarations: [
    AppComponent,
    DisplayComponent,
    VolumeComponent,
    AudiocontrolComponent,
    ManagementComponent,
    HelpDialog,
    ConfirmHelpDialog,
    ViaDialog,
    ErrorDialogComponent,
    StreamModalComponent,
    ProjectorControlComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpModule,
    MatTabsModule,
    MatSliderModule,
    MatButtonModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatIconModule,
    MatDividerModule
  ],
  providers: [
    APIService,
    CommandService,
    DataService,
    GraphService,
    SocketService,
    ErrorService
  ],
  entryComponents: [HelpDialog, ConfirmHelpDialog, ViaDialog, ErrorDialogComponent, StreamModalComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
