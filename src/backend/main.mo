import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Blob "mo:core/Blob";
import Runtime "mo:core/Runtime";

actor {
  type ProdutoId = Nat;
  type VendaId = Nat;
  type FuncionarioId = Nat;
  type FiadoId = Nat;

  public type Categoria = {
    #comida;
    #bebida;
    #outros;
  };

  public type Unidade = {
    #unidade;
    #garrafa;
    #lata;
    #prato;
  };

  public type Produto = {
    id : ProdutoId;
    nome : Text;
    categoria : Categoria;
    precoVenda : Nat;
    precoCusto : Nat;
    stockAtual : Nat;
    stockMinimo : Nat;
    unidade : Unidade;
    ativo : Bool;
  };

  public type MetodoPagamento = {
    #dinheiro;
    #mpesa;
    #emola;
    #outro;
  };

  public type Funcionario = {
    id : FuncionarioId;
    nome : Text;
    pinHash : Blob;
    papel : Papel;
    ativo : Bool;
  };

  public type Papel = {
    #admin;
    #caixa;
    #garcom;
  };

  public type Configuracoes = {
    nomeNegocio : Text;
    moeda : Text;
    tema : {
      #escuro;
      #claro;
    };
  };

  public type VendaItem = {
    produtoId : ProdutoId;
    quantidade : Nat;
    preco : Nat;
  };

  public type Venda = {
    id : VendaId;
    dataHora : Time.Time;
    itens : [VendaItem];
    total : Nat;
    desconto : Nat;
    metodoPagamento : MetodoPagamento;
    funcionarioId : FuncionarioId;
    observacoes : Text;
  };

  public type EstadoFiado = {
    #pendente;
    #pago;
  };

  public type Fiado = {
    id : FiadoId;
    clienteNome : Text;
    clienteTelefone : Text;
    itens : [VendaItem];
    total : Nat;
    data : Time.Time;
    estado : EstadoFiado;
    dataPagamento : ?Time.Time;
  };

  var proximoProdutoId = 1;
  var proximoVendaId = 1;
  var proximoFuncionarioId = 1;
  var proximoFiadoId = 1;

  let produtos = Map.empty<ProdutoId, Produto>();
  let vendas = Map.empty<VendaId, Venda>();
  let funcionarios = Map.empty<FuncionarioId, Funcionario>();
  let fiados = Map.empty<FiadoId, Fiado>();

  var configuracoes : Configuracoes = {
    nomeNegocio = "Caixa Fácil";
    moeda = "MZN";
    tema = #claro;
  };

  public shared ({ caller }) func criarProduto(
    nome : Text,
    categoria : Categoria,
    precoVenda : Nat,
    precoCusto : Nat,
    stockAtual : Nat,
    stockMinimo : Nat,
    unidade : Unidade,
  ) : async Produto {
    let produto : Produto = {
      id = proximoProdutoId;
      nome;
      categoria;
      precoVenda;
      precoCusto;
      stockAtual;
      stockMinimo;
      unidade;
      ativo = true;
    };
    produtos.add(produto.id, produto);
    proximoProdutoId += 1;
    produto;
  };

  public shared ({ caller }) func criarVenda(
    itens : [VendaItem],
    total : Nat,
    desconto : Nat,
    metodoPagamento : MetodoPagamento,
    funcionarioId : FuncionarioId,
    observacoes : Text,
  ) : async Venda {
    let venda : Venda = {
      id = proximoVendaId;
      dataHora = Time.now();
      itens;
      total;
      desconto;
      metodoPagamento;
      funcionarioId;
      observacoes;
    };
    vendas.add(venda.id, venda);
    proximoVendaId += 1;
    venda;
  };

  public shared ({ caller }) func criarFuncionario(
    nome : Text,
    pinHash : Blob,
    papel : Papel,
  ) : async Funcionario {
    let funcionario : Funcionario = {
      id = proximoFuncionarioId;
      nome;
      pinHash;
      papel;
      ativo = true;
    };
    funcionarios.add(funcionario.id, funcionario);
    proximoFuncionarioId += 1;
    funcionario;
  };

  public shared ({ caller }) func criarFiado(
    clienteNome : Text,
    clienteTelefone : Text,
    itens : [VendaItem],
    total : Nat,
  ) : async Fiado {
    let fiado : Fiado = {
      id = proximoFiadoId;
      clienteNome;
      clienteTelefone;
      itens;
      total;
      data = Time.now();
      estado = #pendente;
      dataPagamento = null;
    };
    fiados.add(fiado.id, fiado);
    proximoFiadoId += 1;
    fiado;
  };

  public query ({ caller }) func consultarProdutos() : async [Produto] {
    produtos.values().toArray();
  };

  public query ({ caller }) func consultarVendas() : async [Venda] {
    vendas.values().toArray();
  };

  public query ({ caller }) func consultarFuncionarios() : async [Funcionario] {
    funcionarios.values().toArray();
  };

  public query ({ caller }) func consultarFiados() : async [Fiado] {
    fiados.values().toArray();
  };

  public query ({ caller }) func consultarConfiguracoes() : async Configuracoes {
    configuracoes;
  };

  public shared ({ caller }) func atualizarConfiguracoes(novasConfig : Configuracoes) : async () {
    configuracoes := novasConfig;
  };
};
