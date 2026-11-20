import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { tiposLampadas } from "../pages/LampadasVeiculo";
import { calcularConsumo } from "./consumo";
import { calcularVencimento } from "./vencimentoRevisao";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const margem = 16;
const largura = 178;

const moeda = valor => valor == null || valor === "" ? null : formatoMoeda.format(valor);
const medida = (valor, unidade) => valor == null || valor === "" ? null : `${formatoNumero.format(valor)} ${unidade}`;
const km = valor => medida(valor, "km");
const data = valor => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor || "");
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
};
const recentes = campo => (a, b) => String(b[campo] ?? "").localeCompare(String(a[campo] ?? "")) || b.id - a.id;
const total = (registros, campo) => registros.reduce((soma, item) => soma + (Number(item[campo]) || 0), 0);

async function fotoParaPdf(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    const escala = Math.min(1, 1600 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const contexto = canvas.getContext("2d");
    contexto.fillStyle = "#fff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return { jpeg: canvas.toDataURL("image/jpeg", 0.87), proporcao: canvas.width / canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function gerarFichaVeiculo(db, id) {
  const carId = Number(id);
  const registros = tipo => db[tipo].where("carId").equals(carId).toArray();
  const [carro, revisoes, abastecimentos, compras, desejos] = await Promise.all([
    db.cars.get(carId, { exigirArquivos: true }),
    registros("services"),
    registros("abastecimentos"),
    registros("purchases"),
    registros("wishlist"),
  ]);
  if (!carro) throw new Error("Veículo não encontrado.");

  const anexosPorRegistro = await db.attachments.porRegistros([...revisoes, ...compras].map(item => item.id));
  const consumo = calcularConsumo(abastecimentos);
  const pdf = new jsPDF({ compress: true });
  const arquivos = [];
  let y = margem;

  function reservar(altura) {
    if (y + altura > 277) {
      pdf.addPage();
      y = margem;
    }
  }

  function escrever(conteudo, { tamanho = 10, destaque = false, cor = [33, 41, 37] } = {}) {
    pdf.setFont("helvetica", destaque ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(...cor);
    for (const linha of pdf.splitTextToSize(String(conteudo).replace(/\u00a0/g, " "), largura)) {
      const altura = tamanho * 0.49;
      reservar(altura);
      pdf.text(linha, margem, y + altura * 0.78);
      y += altura;
    }
  }

  function secao(titulo) {
    reservar(18);
    y += 5;
    escrever(titulo, { tamanho: 14, destaque: true, cor: [16, 70, 44] });
    pdf.setDrawColor(214, 225, 218);
    pdf.line(margem, y + 1, margem + largura, y + 1);
    y += 3;
  }

  function item(titulo) {
    reservar(13);
    y += 3;
    escrever(titulo, { tamanho: 11, destaque: true });
  }

  function campos(linhas) {
    for (const [rotulo, valor] of linhas) {
      escrever(`${rotulo}: ${String(valor ?? "").trim() || "—"}`);
    }
  }

  function anexar(blob, nome, descricao, naFicha = false) {
    if (!(blob instanceof Blob)) throw new Error("Um arquivo salvo não está disponível.");
    const referencia = `Anexo ${arquivos.length + 1}`;
    arquivos.push({ blob, nome: `${referencia} - ${nome}`, descricao, naFicha });
    escrever(`${referencia}: ${nome}`);
  }

  function listarAnexos(registro, descricao) {
    for (const anexo of anexosPorRegistro.get(registro.id) || []) {
      const nome = anexo.nomeArquivo || anexo.blob?.name || `Arquivo ${anexo.id}`;
      anexar(anexo.blob, nome, descricao);
    }
  }

  async function foto(blob) {
    let imagem;
    try {
      imagem = await fotoParaPdf(blob);
    } catch {
      return false;
    }
    const altura = Math.min(220, largura / imagem.proporcao);
    const larguraImagem = altura * imagem.proporcao;
    reservar(altura + 3);
    pdf.addImage(imagem.jpeg, "JPEG", margem, y, larguraImagem, altura);
    y += altura + 3;
    return true;
  }

  escrever("CARREV  /  FICHA DO VEÍCULO", { tamanho: 11, destaque: true, cor: [16, 70, 44] });
  escrever(carro.name || "Veículo", { tamanho: 24, destaque: true });
  escrever(`Emitida em ${new Date().toLocaleString("pt-BR")}`);
  if (carro.photo) {
    y += 4;
    const naFicha = await foto(carro.photo);
    anexar(carro.photo, carro.photo.name || "Foto do veículo", "Foto original do veículo", naFicha);
  }

  secao("Identificação e referências");
  campos([
    ["Nome", carro.name], ["Modelo", carro.model], ["Ano", carro.year], ["Placa", carro.plate],
    ["RENAVAM", carro.renavam], ["Chassi", carro.chassis], ["Combustível", carro.fuel],
    ["Quilometragem atual", km(carro.currentMileage)], ["Adquirido em", data(carro.acquiredOn)],
    ["Óleo de motor", carro.oil], ["Pneu", carro.tire],
    ...tiposLampadas.map(([chave, rotulo]) => [rotulo, carro.bulbsByPosition?.[chave]]),
    ["Anotação sobre lâmpadas", carro.bulbs],
  ]);

  secao("Valor do veículo e FIPE");
  const diferenca = Number(carro.purchasePrice) > 0 && carro.fipeValue != null
    ? Number(carro.fipeValue) - Number(carro.purchasePrice) : null;
  campos([
    ["Valor pago", moeda(carro.purchasePrice)], ["FIPE atual", carro.fipeValueFormatted || moeda(carro.fipeValue)],
    ["Diferença", moeda(diferenca)],
    ["Variação", diferenca == null ? null : `${formatoNumero.format(100 * diferenca / carro.purchasePrice)}%`],
    ["Marca FIPE", carro.fipeBrand], ["Modelo FIPE", carro.fipeModel], ["Ano/versão FIPE", carro.fipeModelYear],
    ["Combustível FIPE", carro.fipeFuel], ["Código FIPE", carro.fipeCode], ["Referência", carro.fipeReference],
    ["Atualização FIPE", data(carro.fipeUpdatedAt)],
  ]);

  secao("Documentos e IPVA");
  if (carro.crlvPdf) {
    campos([["CRLV atualizado em", data(carro.crlvPdfUpdatedAt)]]);
    anexar(carro.crlvPdf, carro.crlvPdfName || "CRLV.pdf", "CRLV");
  } else {
    escrever("Nenhum CRLV cadastrado.");
  }
  const exercicios = Object.entries(carro.ipva || {}).filter(([, registro]) => registro).sort(([a], [b]) => b.localeCompare(a));
  if (!exercicios.length) escrever("Nenhum IPVA cadastrado.");
  for (const [ano, ipva] of exercicios) {
    item(`IPVA ${ano}`);
    campos([
      ["Situação", ipva.status], ["Valor", moeda(ipva.valor)], ["Vencimento", data(ipva.vencimento)],
      ["Pagamento", data(ipva.dataPagamento)], ["Última atualização", data(ipva.atualizadoEm)],
    ]);
  }

  secao("Histórico de revisões");
  if (!revisoes.length) escrever("Nenhuma revisão cadastrada.");
  for (const revisao of revisoes.sort(recentes("date"))) {
    const titulo = `${revisao.type || "Revisão"} · ${data(revisao.date) || "Sem data"}`;
    item(titulo);
    campos([
      ["Quilometragem", km(revisao.mileage)], ["Próxima data", data(revisao.nextDate)],
      ["Próxima quilometragem", km(revisao.nextMileage)], ["Observações", revisao.notes],
    ]);
    listarAnexos(revisao, titulo);
  }

  secao("Próximas revisões");
  const proximas = revisoes.filter(revisao => revisao.nextDate || revisao.nextMileage != null);
  if (!proximas.length) escrever("Nenhuma próxima revisão programada.");
  for (const revisao of proximas) {
    const prazo = calcularVencimento(revisao, typeof carro.currentMileage === "number" ? carro.currentMileage : null);
    item(`${revisao.type || "Revisão"} · ${prazo.status}`);
    campos([
      ["Revisão de origem", data(revisao.date)], ["Próxima data", data(revisao.nextDate)],
      ["Próxima quilometragem", km(revisao.nextMileage)], ["Dias até o prazo", prazo.diasAte],
      ["Quilômetros restantes", km(prazo.kmRestante)],
    ]);
  }

  secao("Abastecimentos e consumo");
  campos([
    ["Total gasto", moeda(total(abastecimentos, "precoTotal"))],
    ["Total abastecido", medida(total(abastecimentos, "litros"), "L")],
    ["Consumo médio", medida(consumo.mediaKmL, "km/L")],
    ["Último consumo", medida(consumo.ultimo?.kmPorLitro, "km/L")],
  ]);
  if (!abastecimentos.length) escrever("Nenhum abastecimento cadastrado.");
  for (const registro of abastecimentos.sort(recentes("data"))) {
    item(data(registro.data) || "Abastecimento");
    campos([
      ["Posto/local", registro.local], ["Quilometragem", km(registro.km)],
      ["Quantidade", medida(registro.litros, "L")], ["Valor total", moeda(registro.precoTotal)],
      ["Tanque cheio", registro.tanqueCheio == null ? null : registro.tanqueCheio ? "Sim" : "Não"],
    ]);
  }
  if (consumo.trechos.length) secao("Consumo por tanque");
  for (const trecho of consumo.trechos) {
    item(data(trecho.data) || "Trecho");
    campos([
      ["Odômetro inicial", km(trecho.deKm)], ["Odômetro final", km(trecho.paraKm)],
      ["Distância", km(trecho.distancia)], ["Litros", medida(trecho.litrosUsados, "L")],
      ["Consumo", medida(trecho.kmPorLitro, "km/L")],
      ["Consumo por 100 km", medida(trecho.litrosPor100, "L/100 km")],
    ]);
  }

  secao("Itens estéticos e compras");
  campos([["Total registrado", moeda(total(compras, "price"))]]);
  if (!compras.length) escrever("Nenhum item cadastrado.");
  for (const compra of compras.sort(recentes("date"))) {
    item(compra.part || "Item");
    campos([
      ["Data", data(compra.date)], ["Valor", moeda(compra.price)],
      ["Loja/site", compra.vendor], ["Observações", compra.notes],
    ]);
    listarAnexos(compra, compra.part || "Item estético");
  }

  secao("Lista de desejos");
  campos([["Total estimado", moeda(total(desejos, "estimatedPrice"))]]);
  if (!desejos.length) escrever("Nenhum desejo cadastrado.");
  for (const desejo of desejos.sort(recentes("createdAt"))) {
    item(desejo.part || "Item");
    campos([
      ["Prioridade", desejo.priority], ["Custo estimado", moeda(desejo.estimatedPrice)],
      ["Onde comprar", desejo.vendor], ["Observações", desejo.notes],
    ]);
  }

  if (!arquivos.length) return pdf.output("blob");

  // Mantém os arquivos originais no PDF e acrescenta uma versão imprimível quando possível.
  const completo = await PDFDocument.load(pdf.output("arraybuffer"));
  for (const arquivo of arquivos) {
    const { blob, nome, descricao, naFicha } = arquivo;
    const bytes = await blob.arrayBuffer();
    await completo.attach(bytes, nome, {
      mimeType: blob.type || "application/octet-stream",
      description: descricao,
    });
    if (naFicha) continue;

    const capa = new jsPDF({ compress: true });
    y = margem;
    capa.setFont("helvetica", "bold");
    capa.setFontSize(13);
    const titulo = capa.splitTextToSize(nome, largura).slice(0, 4);
    capa.text(titulo, margem, y);
    capa.setFont("helvetica", "normal");
    capa.setFontSize(10);
    y += titulo.length * 6;
    const origem = capa.splitTextToSize(descricao, largura).slice(0, 4);
    capa.text(origem, margem, y);
    y += origem.length * 5 + 7;

    let paginas = [];
    if (blob.type === "application/pdf" || /\.pdf$/i.test(nome)) {
      try {
        const documento = await PDFDocument.load(bytes);
        paginas = await completo.copyPages(documento, documento.getPageIndices());
      } catch {
        // Um PDF protegido ou incompatível continua disponível como arquivo original.
      }
      if (!paginas.length) capa.text("Abra o PDF original na lista de anexos deste documento.", margem, y);
    } else if (blob.type.startsWith("image/")) {
      let imagem;
      try {
        imagem = await fotoParaPdf(blob);
      } catch {
        // O arquivo original ainda acompanha a ficha.
      }
      if (imagem) {
        const altura = Math.min(277 - y, largura / imagem.proporcao);
        capa.addImage(imagem.jpeg, "JPEG", margem, y, altura * imagem.proporcao, altura);
      } else {
        capa.text("Visualize a imagem nos anexos do PDF.", margem, y);
      }
    } else {
      capa.text("Abra o arquivo original na lista de anexos do PDF.", margem, y);
    }
    const paginaCapa = await PDFDocument.load(capa.output("arraybuffer"));
    const [pagina] = await completo.copyPages(paginaCapa, [0]);
    completo.addPage(pagina);
    for (const anexa of paginas) completo.addPage(anexa);
  }
  return new Blob([await completo.save()], { type: "application/pdf" });
}
