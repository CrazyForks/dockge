import { DockgeSocket } from "./util-server";
import { io } from "socket.io-client";
import { log } from "./log";

/**
 * Dockge Instance Manager
 */
export class DockgeInstanceManager {
    protected static instance: DockgeInstanceManager;

    protected constructor() {
    }

    public static getInstance(): DockgeInstanceManager {
        if (!DockgeInstanceManager.instance) {
            DockgeInstanceManager.instance = new DockgeInstanceManager();
        }
        return DockgeInstanceManager.instance;
    }

    connect(socket: DockgeSocket) {

        let list : Record<string, { username : string, password : string}> = {
            "ws://louis-twister-pi:5001": {
                username: "admin",
                password: process.env.DOCKGE_PW || "",
            }
        };

        if (Object.keys(list).length !== 0) {
            log.info("INSTANCEMANAGER", "Connecting to all instance socket server(s)...");
        }

        for (let url in list) {
            let item = list[url];

            let client = io(url, {
                transports: [ "websocket", "polling" ],
            });

            client.on("connect", () => {
                log.info("INSTANCEMANAGER", "Connected to the socket server: " + url);

                client.emit("login", {
                    username: item.username,
                    password: item.password,
                }, (res) => {
                    if (res.ok) {
                        log.info("INSTANCEMANAGER", "Logged in to the socket server: " + url);
                    } else {
                        log.error("INSTANCEMANAGER", "Failed to login to the socket server: " + url);
                    }
                });
            });

            // Catch all events
            client.onAny((eventName, ...args) => {
                log.debug("INSTANCEMANAGER", "Received event: " + eventName);

                let proxyEventList = [
                    "stackList",
                ];

                if (proxyEventList.includes(eventName)) {
                    socket.emit(eventName, ...args, url);
                } else {
                    log.debug("INSTANCEMANAGER", "Event not in the proxy list: " + eventName);
                }
            });

            socket.instanceSocketList[url] = client;
        }
    }

    disconnect(socket: DockgeSocket) {
        for (let url in socket.instanceSocketList) {
            let client = socket.instanceSocketList[url];
            client.disconnect();
        }
    }
}
