import { Injectable, EventEmitter } from '@angular/core';
import { Http, Response, Headers, RequestOptions } from '@angular/http';
import { Observable } from 'rxjs/Rx';
import { UIConfiguration, Room, RoomConfiguration, RoomStatus, Device } from './objects';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/timeout';
import { deserialize } from 'serializer.ts/Serializer';

const RETRY_TIMEOUT = 5 * 1000;
const MONITOR_TIMEOUT = 30 * 1000;

@Injectable()
export class APIService {
	public loaded: EventEmitter<boolean>;

	public static building: string;
	public static roomName: string;
	public static hostname: string;
	public static apiurl: string;

	public static uiconfig: UIConfiguration;
	public static room: Room;

	private static apihost: string;
	private static localurl: string;
	private static options: RequestOptions;

	constructor(private http: Http) {
		this.loaded = new EventEmitter<boolean>();

		if (APIService.options == null) {
			let headers = new Headers();
			headers.append('content-type', 'application/json');
			APIService.options = new RequestOptions({ headers: headers})
	
			let base = location.origin.split(':');
			APIService.localurl = base[0] + ":" + base[1];
	
			APIService.uiconfig = new UIConfiguration();
			APIService.room = new Room();	
			
			this.setupHostname();
		} else {
			this.loaded.emit(true);	
		}
	}

	// hostname, building, room
	public setupHostname() {
		this.getHostname().subscribe(
			data => {
				APIService.hostname = String(data);

				let split = APIService.hostname.split('-');
				APIService.building = split[0];
				APIService.roomName = split[1];
				
				this.setupAPIUrl(false);
			}, err => {
				setTimeout(() => this.setupHostname(), RETRY_TIMEOUT);
			});
	}

	private setupAPIUrl(next: boolean) {
		if (next) {
			console.warn("switching to next api")
			this.getNextAPIUrl().subscribe(
				data => {
				}, err => {
					setTimeout(() => this.setupAPIUrl(next), RETRY_TIMEOUT);
				}
			)
		}

		this.getAPIUrl().subscribe(
			data => {
				APIService.apihost = "http://" + location.hostname;
				if (!data["apihost"].includes("localhost") && data["enabled"]) {
					APIService.apihost = "http://" + data["apihost"];
				}

				APIService.apiurl = APIService.apihost + ":8000/buildings/" + APIService.building + "/rooms/" + APIService.roomName; 
				console.info("API url:", APIService.apiurl);

				if (data["enabled"] && !next) {
					console.info("Monitoring API");
					this.monitorAPI();
				}

				if (!next) {
					this.setupUIConfig();
				}
			}, err => {
				setTimeout(() => this.setupAPIUrl(next), RETRY_TIMEOUT);
			}
		)
	}

	private monitorAPI() {
		this.getAPIHealth().subscribe(data => {
			if (data["statuscode"] != 0) {
				this.setupAPIUrl(true);
			}

			setTimeout(() => this.monitorAPI(), MONITOR_TIMEOUT);
		}, err => {
			this.setupAPIUrl(true);
			setTimeout(() => this.monitorAPI(), MONITOR_TIMEOUT);
		});
	}

	private setupUIConfig() {
		this.getUIConfig().subscribe(
			data => {
				APIService.uiconfig = new UIConfiguration();
				Object.assign(APIService.uiconfig, data);
				console.info("UI Configuration:", APIService.uiconfig);

				this.setupRoomConfig();
			}, err => {
				setTimeout(() => this.setupUIConfig(), RETRY_TIMEOUT);
			}
		);
	}

	private setupRoomConfig() {
		this.getRoomConfig().subscribe(
			data => {
				APIService.room.config = new RoomConfiguration();
				Object.assign(APIService.room.config, data);

				console.info("Room Configuration:", APIService.room.config);

				this.setupRoomStatus();
			}, err => {
				setTimeout(() => this.setupRoomConfig(), RETRY_TIMEOUT);
			}
		);
	}

	private setupRoomStatus() {
		this.getRoomStatus().subscribe(
			data => {
				APIService.room.status = new RoomStatus();
				Object.assign(APIService.room.status, data);
				console.info("Room Status:", APIService.room.status);

				this.loaded.emit(true);
			}, err => {
				setTimeout(() => this.setupRoomStatus(), RETRY_TIMEOUT);
			}
		);
	}

	get(url: string, success: Function = func => {}, err: Function = func => { }, after: Function = func => {}): void {
		this.http.get(url)
			.map(response => response.json())
			.subscribe(
			data => {
				success();
			},
			error => {
				console.error("error:", error);
				err();
			},
			() => {
				after();
			}
		);
	}

	getHostname(): Observable<Object> {
		return this.http.get(APIService.localurl + ":8888/hostname")
			.map(response => response.json());
	}

	getAPIUrl(): Observable<Object> {
		return this.http.get(APIService.localurl + ":8888/api")
			.map(response => response.json());
	}

	getAPIHealth(): Observable<Object> {
		return this.http.get(APIService.apihost + ":8000/mstatus")
			.timeout(RETRY_TIMEOUT)
			.map(response => response.json());
	}

	getNextAPIUrl(): Observable<Object> {
		return this.http.get(APIService.localurl + ":8888/nextapi")
			.map(response => response.json());
	}

	getUIConfig(): Observable<Object> {
		return this.http.get(APIService.localurl + ":8888/json")
			.map(response => response.json())
			.map(res => deserialize<UIConfiguration>(UIConfiguration, res));
	}

	getRoomConfig(): Observable<Object> {
		return this.http.get(APIService.apiurl + "/configuration")
			.map(response => response.json())
			.map(res => deserialize<RoomConfiguration>(RoomConfiguration, res));
	}

	getRoomStatus(): Observable<Object> {
		return this.http.get(APIService.apiurl)
			.map(response => response.json())
			.map(res => deserialize<RoomStatus>(RoomStatus, res));
	}
}
