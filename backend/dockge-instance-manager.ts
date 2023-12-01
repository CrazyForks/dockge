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

        let list : Record<string, {tls : boolean, username : string, password : string}> = {
            "louis-twister-pi:5001": {
                tls: false,
                username: "admin",
                password: process.env.DOCKGE_PW || "",
            }
        };

        if (Object.keys(list).length !== 0) {
            log.info("INSTANCEMANAGER", "Connecting to all instance socket server(s)...");
        }

        for (let endpoint in list) {
            let item = list[endpoint];

            let url = (item.tls) ? "wss://" : "ws://";
            url += endpoint;

            log.info("INSTANCEMANAGER", "Connecting to the socket server: " + endpoint);
            let client = io(url, {
                transports: [ "websocket", "polling" ],
            });

            client.on("connect", () => {
                log.info("INSTANCEMANAGER", "Connected to the socket server: " + endpoint);

                client.emit("login", {
                    username: item.username,
                    password: item.password,
                }, (res) => {
                    if (res.ok) {
                        log.info("INSTANCEMANAGER", "Logged in to the socket server: " + endpoint);
                    } else {
                        log.error("INSTANCEMANAGER", "Failed to login to the socket server: " + endpoint);
                    }
                });
            });

            client.on("error", (err) => {
                log.error("INSTANCEMANAGER", "Error from the socket server: " + endpoint);
                log.error("INSTANCEMANAGER", err);
            });

            client.on("disconnect", () => {
                log.info("INSTANCEMANAGER", "Disconnected from the socket server: " + endpoint);
            });

            // Catch all events
            client.onAny((eventName, ...args) => {
                log.debug("INSTANCEMANAGER", "Received event: " + eventName);

                let proxyEventList = [
                    "stackList",
                ];

                if (proxyEventList.includes(eventName) &&
                    args.length >= 1 &&
                    typeof(args[0]) === "object" &&
                    args[0].endpoint === undefined      // Only proxy the event from the endpoint, any upstream event will be ignored
                ) {
                    args[0].endpoint = endpoint;
                    socket.emit(eventName, ...args);
                } else {
                    log.debug("INSTANCEMANAGER", "Event not in the proxy list or cannot set endpoint to the res: " + eventName);
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
