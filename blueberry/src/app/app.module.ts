import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { HttpModule } from "@angular/http";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import {
  MatSliderModule,
  MatIconModule,
  MatMenuModule,
  MatDialogModule,
  MatGridListModule,
  MatChipsModule,
  MatProgressSpinnerModule,
  MatProgressBarModule
} from "@angular/material";
import { UiSwitchModule } from "ngx-ui-switch";
import { SweetAlert2Module } from "@toverux/ngx-sweetalert2";
import "hammerjs";
import { MatButtonModule } from "@angular/material/button";

import { AppComponent } from "./components/app.component";
import { HomeComponent } from "./components/home.component";
import { WheelComponent } from "./components/wheel.component";
import { ManagementComponent } from "./components/management.component";
import { APIService } from "./services/api.service";
import { SocketService } from "./services/socket.service";
import { CommandService } from "./services/command.service";
import { DataService } from "./services/data.service";
import { GraphService } from "./services/graph.service";
import { HelpModal } from "./modals/helpmodal/helpmodal.component";
import { ConfirmHelpModal } from "./modals/confirmhelpmodal/confirmhelpmodal.component";
import { PowerOffAllModalComponent } from "./modals/poweroffallmodal/poweroffallmodal.component";
import { ActivityButtonComponent } from "./components/activity-button/activity-button.component";
import { ShareModalComponent } from "./modals/sharemodal/sharemodal.component";
import { AudioComponent } from "./components/audio/audio.component";
import { VolumeComponent } from "./components/volume/volume.component";
import { MirrorModalComponent } from "./modals/mirrormodal/mirrormodal.component";
import { MessageModalComponent } from "./modals/messagemodal/messagemodal.component";
import { ErrorModalComponent } from "./modals/errormodal/errormodal.component";
import { ErrorService } from "./services/error.service";
import { StreamModalComponent } from "./modals/streammodal/streammodal.component";
import { ProjectorComponent } from './components/projector/projector.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    WheelComponent,
    ManagementComponent,
    HelpModal,
    ConfirmHelpModal,
    PowerOffAllModalComponent,
    ActivityButtonComponent,
    ShareModalComponent,
    AudioComponent,
    VolumeComponent,
    MirrorModalComponent,
    MessageModalComponent,
    ErrorModalComponent,
    StreamModalComponent,
    ProjectorComponent,
  ],
  imports: [
    BrowserModule,
    HttpModule,
    BrowserAnimationsModule,
    MatSliderModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDialogModule,
    MatGridListModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    UiSwitchModule,
    SweetAlert2Module.forRoot()
  ],
  providers: [
    APIService,
    SocketService,
    CommandService,
    DataService,
    GraphService,
    ErrorService
  ],
  entryComponents: [
    HelpModal,
    ConfirmHelpModal,
    PowerOffAllModalComponent,
    ShareModalComponent,
    MirrorModalComponent,
    MessageModalComponent,
    ErrorModalComponent,
    StreamModalComponent,
    ProjectorComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
