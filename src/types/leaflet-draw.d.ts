import "leaflet";

declare module "leaflet" {
    namespace Control {
        interface DrawConstructorOptions {
            position?: string;
            draw?: Record<string, unknown>;
            edit?: Record<string, unknown>;
        }

        class Draw extends Control {
            constructor(options?: DrawConstructorOptions);
        }
    }

    namespace Draw {
        namespace Event {
            const CREATED: string;
            const DELETED: string;
            const EDITED: string;
        }
    }

    namespace DrawEvents {
        interface Created extends LeafletEvent {
            layer: Layer;
            layerType: string;
        }
    }
}
