export type Option = { value: string; label: string };

export type IdName = { id: number; name: string };

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
};

export type Role = {
    id: number;
    name: string;
    description: string | null;
    scope: 'all' | 'office' | 'route';
    permissions: string[];
    users_count?: number;
};

export type Office = {
    id: number;
    code: string;
    name: string;
    city: string | null;
    address: string | null;
    phone: string | null;
    is_active: boolean;
    routes_count?: number;
    users_count?: number;
    machines_count?: number;
};

export type AppUser = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role_id: number | null;
    office_id: number | null;
    is_active: boolean;
    role?: IdName | null;
    office?: IdName | null;
};

export type CollectionRoute = {
    id: number;
    office_id: number;
    collector_id: number | null;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
    clients_count?: number;
    office?: IdName;
    collector?: IdName | null;
};

export type Client = {
    id: number;
    collection_route_id: number;
    name: string;
    business_name: string | null;
    document: string | null;
    phone: string | null;
    address: string | null;
    /** Ciudad o municipio. */
    city: string | null;
    /** Distrito, zona, colonia o aldea. */
    district: string | null;
    latitude: string | null;
    longitude: string | null;
    commission_percent: string;
    loss_balance: string;
    visit_order: number;
    /** Día de visita ISO: 1 = lunes … 7 = domingo. */
    visit_day: number | null;
    notes: string | null;
    /** Foto del cliente (se ve con la ruta clients.photo, kind "client"). */
    photo_path: string | null;
    /** Foto del negocio (ruta clients.photo, kind "business"). */
    business_photo_path: string | null;
    is_active: boolean;
    machines_count?: number;
    installed_machines_count?: number;
    collected_machines_count?: number;
    /** Último corte del cliente en la semana actual. */
    week_collection_id?: number | null;
    loans_balance?: string | null;
    collection_route?: {
        id: number;
        code: string;
        name: string;
        office?: IdName;
        collector?: IdName | null;
    };
    machines?: Machine[];
    loans?: Loan[];
    active_loans?: Loan[];
};

export type MachineStatus =
    | 'warehouse'
    | 'installed'
    | 'maintenance'
    | 'retired';

export type Machine = {
    id: number;
    office_id: number;
    client_id: number | null;
    code: string;
    serial: string | null;
    brand: string | null;
    model: string | null;
    credit_value: string;
    counter_in: number;
    counter_out: number;
    purchase_cost: string | null;
    installed_at: string | null;
    status: MachineStatus;
    notes: string | null;
    /** Foto de la máquina (ruta machines.photo). Opcional en listados reducidos. */
    photo_path?: string | null;
    office?: IdName;
    client?:
        | (IdName & { collection_route?: { id: number; code: string } })
        | null;
    /** Últimas lecturas (histórico rápido del corte). */
    recent_readings?: CollectionItem[];
};

/** Montos (Q por semana) para clasificar el rendimiento de las máquinas. */
export type PerformanceThresholdsInfo = {
    excellent: number;
    poor: number;
    excellent_presets: number[];
    poor_presets: number[];
};

export type PerformanceLevel = 'excellent' | 'good' | 'poor';

/** Cliente destino para mover máquinas. */
export type MoveClient = IdName & { office_id: number };

export type MachineMovement = {
    id: number;
    machine_id: number;
    type: 'transfer' | 'warehouse' | 'install';
    from_client_id: number | null;
    to_client_id: number | null;
    counter_in: number;
    counter_out: number;
    reason: string | null;
    created_at: string;
    user?: IdName | null;
    from_client?: IdName | null;
    to_client?: IdName | null;
};

export type CollectionItem = {
    id: number;
    machine_id: number;
    previous_in: number;
    current_in: number;
    previous_out: number;
    current_out: number;
    credit_value: string;
    amount_in: string;
    amount_out: string;
    net: string;
    forced: boolean;
    cash_counted: string | null;
    notes: string | null;
    photo_path: string | null;
    machine?: Pick<Machine, 'id' | 'code' | 'brand' | 'model'>;
    collection?: {
        id: number;
        collected_on: string;
        client?: IdName;
        user?: IdName;
    };
};

export type Collection = {
    id: number;
    office_id: number;
    collection_route_id: number;
    client_id: number;
    user_id: number;
    collected_on: string;
    total_in: string;
    total_out: string;
    net: string;
    commission_percent: string;
    client_share: string;
    company_share: string;
    loss_offset: string;
    loss_added: string;
    loan_deduction: string;
    client_paid: string;
    cash_delivered: string;
    notes: string | null;
    signature_path: string | null;
    created_at: string;
    items_count?: number;
    client?: IdName & {
        business_name?: string | null;
        phone?: string | null;
        address?: string | null;
    };
    collection_route?: { id: number; code: string; name?: string };
    office?: IdName;
    user?: IdName;
    items?: CollectionItem[];
};

export type Expense = {
    id: number;
    office_id: number;
    collection_route_id: number | null;
    machine_id: number | null;
    user_id: number;
    category: string;
    amount: string;
    spent_on: string;
    description: string | null;
    office?: IdName;
    collection_route?: { id: number; code: string } | null;
    machine?: { id: number; code: string } | null;
    user?: IdName;
};

export type LoanStatus = 'active' | 'paid' | 'cancelled';

export type LoanPayment = {
    id: number;
    loan_id: number;
    collection_id: number | null;
    amount: string;
    paid_on: string;
    notes: string | null;
    user?: IdName;
};

export type Loan = {
    id: number;
    client_id: number;
    principal: string;
    interest_percent: string;
    total: string;
    balance: string;
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    installments: number;
    installment_amount: string;
    issued_on: string;
    first_due_on: string;
    status: LoanStatus;
    notes: string | null;
    arrears?: number;
    client?: IdName & {
        business_name?: string | null;
        collection_route?: { id: number; code: string };
    };
    user?: IdName;
    office?: IdName;
    payments?: LoanPayment[];
};
