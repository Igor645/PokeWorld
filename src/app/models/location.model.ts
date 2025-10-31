import { Name } from "./name.model";

export interface Location {
    id: number;
    name: string;
    region_id: number;
    locationnames: Name[];
}
