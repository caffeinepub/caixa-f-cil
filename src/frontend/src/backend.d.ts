import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type FuncionarioId = bigint;
export interface Configuracoes {
    moeda: string;
    tema: Variant_claro_escuro;
    nomeNegocio: string;
}
export type Time = bigint;
export type ProdutoId = bigint;
export interface Venda {
    id: VendaId;
    desconto: bigint;
    total: bigint;
    metodoPagamento: MetodoPagamento;
    funcionarioId: FuncionarioId;
    dataHora: Time;
    observacoes: string;
    itens: Array<VendaItem>;
}
export type VendaId = bigint;
export interface Fiado {
    id: FiadoId;
    total: bigint;
    data: Time;
    dataPagamento?: Time;
    clienteNome: string;
    itens: Array<VendaItem>;
    clienteTelefone: string;
    estado: EstadoFiado;
}
export interface VendaItem {
    produtoId: ProdutoId;
    preco: bigint;
    quantidade: bigint;
}
export interface Funcionario {
    id: FuncionarioId;
    ativo: boolean;
    nome: string;
    pinHash: Uint8Array;
    papel: Papel;
}
export interface Produto {
    id: ProdutoId;
    categoria: Categoria;
    ativo: boolean;
    nome: string;
    stockAtual: bigint;
    stockMinimo: bigint;
    unidade: Unidade;
    precoVenda: bigint;
    precoCusto: bigint;
}
export type FiadoId = bigint;
export enum Categoria {
    outros = "outros",
    bebida = "bebida",
    comida = "comida"
}
export enum EstadoFiado {
    pendente = "pendente",
    pago = "pago"
}
export enum MetodoPagamento {
    mpesa = "mpesa",
    outro = "outro",
    emola = "emola",
    dinheiro = "dinheiro"
}
export enum Papel {
    admin = "admin",
    caixa = "caixa",
    garcom = "garcom"
}
export enum Unidade {
    lata = "lata",
    garrafa = "garrafa",
    unidade = "unidade",
    prato = "prato"
}
export enum Variant_claro_escuro {
    claro = "claro",
    escuro = "escuro"
}
export interface backendInterface {
    atualizarConfiguracoes(novasConfig: Configuracoes): Promise<void>;
    consultarConfiguracoes(): Promise<Configuracoes>;
    consultarFiados(): Promise<Array<Fiado>>;
    consultarFuncionarios(): Promise<Array<Funcionario>>;
    consultarProdutos(): Promise<Array<Produto>>;
    consultarVendas(): Promise<Array<Venda>>;
    criarFiado(clienteNome: string, clienteTelefone: string, itens: Array<VendaItem>, total: bigint): Promise<Fiado>;
    criarFuncionario(nome: string, pinHash: Uint8Array, papel: Papel): Promise<Funcionario>;
    criarProduto(nome: string, categoria: Categoria, precoVenda: bigint, precoCusto: bigint, stockAtual: bigint, stockMinimo: bigint, unidade: Unidade): Promise<Produto>;
    criarVenda(itens: Array<VendaItem>, total: bigint, desconto: bigint, metodoPagamento: MetodoPagamento, funcionarioId: FuncionarioId, observacoes: string): Promise<Venda>;
}
