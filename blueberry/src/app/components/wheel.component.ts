import {
  Component,
  Input as AngularInput,
  Output as AngularOutput,
  AfterContentInit,
  ElementRef,
  ViewChild,
  EventEmitter
} from "@angular/core";
import swal, { SweetAlertOptions } from "sweetalert2";
import { SwalComponent, SwalPartialTargets } from "@toverux/ngx-sweetalert2";

import { Preset, AudioConfig } from "../objects/objects";
import { Display, Input, AudioDevice } from "../objects/status.objects";
import { CommandService } from "../services/command.service";
import { Event } from "../services/socket.service";
import { APIService } from "../services/api.service";

@Component({
  selector: "wheel",
  templateUrl: "./wheel.component.html",
  styleUrls: ["./wheel.component.scss", "../colorscheme.scss"]
})
export class WheelComponent implements AfterContentInit {
  private static TITLE_ANGLE = 100;
  private static TITLE_ANGLE_ROTATE: number = WheelComponent.TITLE_ANGLE / 2;

  @AngularInput()
  preset: Preset;
  @AngularInput()
  blur: boolean;
  @AngularInput()
  top: string;
  @AngularInput()
  right: string;
  @AngularInput()
  openControlledByPower: boolean;
  @AngularInput()
  sharing: boolean;
  @AngularOutput()
  init: EventEmitter<any> = new EventEmitter();

  arcpath: string;
  titlearcpath: string;
  rightoffset: string;
  topoffset: string;
  translate: string;
  circleOpen = false;
  thumbLabel = true;

  @ViewChild("wheel")
  wheel: ElementRef;

  // for via control
  @ViewChild("via")
  viaDialog: SwalComponent;
  openInput: Input;

  constructor(
    public command: CommandService,
    private api: APIService,
    public readonly swalTargets: SwalPartialTargets
  ) {}

  ngAfterContentInit() {
    setTimeout(() => {
      this.render();
      this.init.emit(true);
      if (this.openControlledByPower) {
        setInterval(() => {
          this.circleOpen = this.getPower() === "on";
        }, 1000);
      }
    }, 0);
  }

  public toggle() {
    if (this.circleOpen) {
      this.close();
    } else {
      this.open(true, 0);
    }
  }

  public open(togglePower: boolean, delay: number) {
    if (togglePower && this.getPower() !== "on") {
      this.command.setPower("on", this.preset.displays);
    }

    setTimeout(() => {
      this.circleOpen = true;
    }, delay);
  }

  public close() {
    this.circleOpen = false;
  }

  public render() {
    this.setTranslate();

    const numOfChildren =
      this.preset.inputs.length + this.preset.extraInputs.length;
    const children = this.wheel.nativeElement.children;
    const angle = (360 - WheelComponent.TITLE_ANGLE) / numOfChildren;

    this.arcpath = this.getArc(0.5, 0.5, 0.5, 0, angle);
    this.titlearcpath = this.getArc(
      0.5,
      0.5,
      0.5,
      0,
      WheelComponent.TITLE_ANGLE
    );

    let rotate =
      "rotate(" + String(-WheelComponent.TITLE_ANGLE_ROTATE) + "deg)";
    children[0].style.transform = rotate;
    children[0 + numOfChildren + 1].style.transform = rotate; // rotate the line the corrosponds to this slice
    rotate = "rotate(" + String(WheelComponent.TITLE_ANGLE_ROTATE) + "deg)";
    children[0].firstElementChild.style.transform = rotate;

    for (let i = 1; i <= numOfChildren; ++i) {
      rotate =
        "rotate(" +
        String(angle * -i - WheelComponent.TITLE_ANGLE_ROTATE) +
        "deg)";
      children[i].style.transform = rotate;
      children[i + numOfChildren + 1].style.transform = rotate; // rotate the line that corrosponds to this slice

      rotate =
        "rotate(" +
        String(angle * i + WheelComponent.TITLE_ANGLE_ROTATE) +
        "deg)";
      children[i].firstElementChild.style.transform = rotate;
    }

    this.setInputOffset();
  }

  private setTranslate() {
    const offsetX: number = parseInt(this.right, 10);
    const offsetY: number = parseInt(this.top, 10);

    const x = 50 - offsetX;
    const y = 50 - offsetY;

    this.translate = String("translate(" + x + "vw," + y + "vh)");
  }

  private setInputOffset() {
    let top: number;
    let right: number;

    switch (this.preset.inputs.length + this.preset.extraInputs.length) {
      case 7:
        top = -0.6;
        right = 25.4;
        break;
      case 6:
        top = 0.8;
        right = 24;
        break;
      case 5:
        top = 2;
        right = 20.4;
        break;
      case 4:
        top = 4;
        right = 17.5;
        break;
      case 3:
        top = 9;
        right = 12;
        break;
      case 2:
        top = 20;
        right = 2;
        break;
      case 1:
        top = 63;
        right = 7;
        break;
      default:
        console.warn(
          "no configuration for",
          this.preset.inputs.length + this.preset.extraInputs.length,
          "displays"
        );
        break;
    }

    this.topoffset = String(top) + "%";
    this.rightoffset = String(right) + "%";
  }

  private getArc(x, y, radius, startAngle, endAngle): string {
    const start = this.polarToCart(x, y, radius, endAngle);
    const end = this.polarToCart(x, y, radius, startAngle);

    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";

    const d = [
      "M",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArc,
      0,
      end.x,
      end.y,
      "L",
      x,
      y,
      "L",
      start.x,
      start.y
    ].join(" ");

    return d;
  }

  private polarToCart(cx, cy, r, angle) {
    const angleInRad = ((angle - 90) * Math.PI) / 180.0;

    return {
      x: cx + r * Math.cos(angleInRad),
      y: cy + r * Math.sin(angleInRad)
    };
  }

  public closeThumb() {
    setTimeout(() => {
      document.getElementById("slider").blur();
    }, 750);
  }

  getInput(): Input {
    return Display.getInput(this.preset.displays);
  }

  getBlank(): boolean {
    return Display.getBlank(this.preset.displays);
  }

  getPower(): string {
    return Display.getPower(this.preset.displays);
  }

  getVolume(): number {
    return AudioDevice.getVolume(this.preset.audioDevices);
  }

  getMute(): boolean {
    return AudioDevice.getMute(this.preset.audioDevices);
  }

  private openInputModal(i: Input) {
    if (i.getName().includes("VIA")) {
      this.openInput = i;
      console.log("opening via modal for input:", this.openInput);
      this.viaDialog.show();
    }
  }

  public share(displays: Display[]): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter();

    this.command.share(this.preset.displays[0], displays).subscribe(success => {
      if (success) {
        ret.emit(true);
      } else {
        ret.emit(false);
      }
    });

    return ret;
  }

  public unShare(
    from: Display[],
    fromAudio: AudioConfig[]
  ): EventEmitter<boolean> {
    const ret: EventEmitter<boolean> = new EventEmitter();

    this.command.unShare(from, fromAudio).subscribe(success => {
      if (success) {
        ret.emit(true);
      } else {
        ret.emit(false);
      }
    });

    return ret;
  }

  private viaControl(endpoint: string) {
    this.viaDialog.nativeSwal.showLoading();

    this.command.viaControl(this.openInput, endpoint).subscribe(success => {
      if (swal.isVisible()) {
        swal({
          type: success ? "success" : "error",
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  public getDisplayNames(): string[] {
    const names: string[] = [];

    if (this.preset == null || this.preset.displays == null) {
      return names;
    }

    for (const d of this.preset.displays) {
      names.push(d.name);
    }

    return names;
  }

  public getAudioNames(): string[] {
    const names: string[] = [];

    if (this.preset == null || this.preset.audioDevices == null) {
      return names;
    }

    for (const a of this.preset.audioDevices) {
      names.push(a.name);
    }

    return names;
  }
}
