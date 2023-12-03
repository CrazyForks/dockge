import { DockgeSocket } from "./util-server";
import { io, Socket as SocketClient } from "socket.io-client";
import { log } from "./log";
import { addEndpointToTerminalName, convertToRemoteStackID } from "./util-common";

/**
 * Dockge Instance Manager
 */
export class DockgeInstanceManager {

    protected socket : DockgeSocket;
    protected instanceSocketList : Record<string, SocketClient> = {};

    constructor(socket: DockgeSocket) {
        this.socket = socket;
    }

    connect(endpoint : string, tls : boolean, username : string, password : string) {
        if (this.instanceSocketList[endpoint]) {
            log.debug("INSTANCEMANAGER", "Already connected to the socket server: " + endpoint);
            return;
        }

        let url = ((tls) ? "wss://" : "ws://") + endpoint;

        log.info("INSTANCEMANAGER", "Connecting to the socket server: " + endpoint);
        let client = io(url, {
            transports: [ "websocket", "polling" ],
        });

        client.on("connect", () => {
            log.info("INSTANCEMANAGER", "Connected to the socket server: " + endpoint);

            client.emit("login", {
                username: username,
                password: password,
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

        client.on("stackList", (res) => {
            if (res.endpoint) {
                log.debug("INSTANCEMANAGER", "Received stackList from endpoint, ignore: " + res.endpoint);
                return;
            }

            res.endpoint = endpoint;

            let newStackList : Record<string, any> = {};

            for (let stackName in res.stackList) {
                let stack = res.stackList[stackName];
                stack.endpoint = endpoint;
                stack.id = convertToRemoteStackID(stack.name, endpoint);
                newStackList[stack.name] = stack;
            }
            this.socket.emit("stackList", res);
        });

        client.on("terminalWrite", (terminalName, data) => {
            this.socket.emit("terminalWrite", addEndpointToTerminalName(terminalName, endpoint), data);
        });

        this.instanceSocketList[endpoint] = client;
    }

    disconnect(endpoint : string) {
        let client = this.instanceSocketList[endpoint];
        client?.disconnect();
    }

    connectAll() {
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
            this.connect(endpoint, item.tls, item.username, item.password);
        }
    }

    disconnectAll() {
        for (let endpoint in this.instanceSocketList) {
            this.disconnect(endpoint);
        }
    }

    emitToEndpoint(endpoint: string, eventName: string, ...args : unknown[]) {
        log.debug("INSTANCEMANAGER", "Emitting event to endpoint: " + endpoint);
        let client = this.instanceSocketList[endpoint];
        client?.emit(eventName, ...args);
    }

}
