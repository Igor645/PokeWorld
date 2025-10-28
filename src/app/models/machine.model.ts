import { Item } from "./item.model";

export interface Machine {
    id: number;
    machine_number: number;
    version_group_id: number;
    item: Item;
}
