import { DockgeServer } from "./dockge-server";
import { DockgeSocket } from "./util-server";
import { log } from "./log";

export abstract class SocketHandler {
    abstract create(socket : DockgeSocket, server : DockgeServer): void;

    event(eventName : string, socket : DockgeSocket, callback: (...args: any[]) => void) {

        socket.on(eventName, (...args) => {
            log.debug("SOCKET", "Received event: " + eventName);

            let req = args[0];
            let endpoint = req.endpoint;

            if (endpoint) {
                socket.instanceManager.emitToEndpoint(endpoint, eventName, ...args);
            } else {
                callback(...args);
            }
        });
    }
}
