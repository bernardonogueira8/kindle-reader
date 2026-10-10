# 📖 Kindle Reader

Read EPUB, FB2 and PDF books inside Obsidian — with highlights, comments, notes
and reading progress that syncs with your vault.

*Kindle-reader is based on Book Reader by Elton, which provided the original URL import base. This project was substantially rewritten and extended with new features.*

**[English](#-kindle-reader) · [Português](#-kindle-reader-em-português)**

Works on desktop and on mobile (Android / iOS).

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/bernardonogueira8)

![Book Reader](docs/promo-hero-en.jpg)

|  |  |
| --- | --- |
| ![Library](docs/promo-library-en.jpg) | ![Reading](docs/promo-reading-en.jpg) |
| **Library** — covers, progress and categories for every book. | **Reading** — a two-column spread, your font, size and theme. |
| ![Highlights](docs/promo-highlights-en.jpg) | ![AI](docs/promo-ai-en.jpg) |
| **Highlights → notes** — four colours, a comment, and a note with the quote, the book link and the page. | **Explain a passage** — a conversation, with the book's title sent as background context. |
| ![Mobile](docs/promo-mobile-en.jpg) | ![Themes](docs/promo-themes-en.jpg) |
| **On the phone** — its own layout: gestures and «⋯», nothing else. Position and highlights travel with your vault. | **Four themes** — light, sepia, dark and e-ink, plus auto that follows your Obsidian theme. |

---

## What it does

**Reading.** EPUB, FB2 and PDF. Paged layout in one or two columns, like a real book. Dark, light and sepia themes, plus an e-ink mode for Android readers. Adjustable fonts (including Kindle classics Bookerly and Caecilia), size, line height, paragraph/word/letter spacing, 4 margin sizes, alignment and line width. Table of contents built from PDF bookmarks, headings or the book's own printed contents page. Full-text search across the whole book.

**Highlights and notes.** Four colours. A comment can be attached to any highlight and travels with it into your notes. Turn a highlight into a note, or export all of a book's highlights at once — grouped by chapter, with page numbers.

**Progress.** Stored as files in your vault next to the books, so it rides whatever you already use to sync (Obsidian Sync, iCloud, Google Drive, Remotely Save…). The position is anchored by paragraph, so a phone and a desktop find the same spot at any screen size.

**Library.** A visual grid of every book with covers, progress and categories. Add books by dragging them in.

## Support the project

If you enjoy using **Kindle Reader** and want to support its ongoing development and maintenance, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/bernardonogueira8)

---

## Install

The listing is under review; until it goes live, install with BRAT or by hand.

### By hand

Download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/bernardonogueira8/kindle-reader/releases/latest)
into `<vault>/.obsidian/plugins/kindle-reader/`, then reload Obsidian.

---

## Privacy and network use

**The reader works fully offline.** Books, progress, highlights and notes never leave your device — the PDF engine is bundled into the plugin, so not even fonts or workers are fetched from the internet.

There is exactly one feature that makes a network request, and it is **off by default**:

| Feature | Service | What is sent | Default |
|---|---|---|---|
| Translate a selection | Google Translate (`translate.googleapis.com`) | Only the passage you selected | **Off** |
| AI passage breakdown | The service **you** pick — OpenRouter, OpenAI, or a local Ollama / LM Studio | Only the passage you selected | **Off** |

Both are turned on in *Settings → Translation*, and each says the same thing in its own description before you enable it. The AI breakdown additionally needs a provider and a key before it will do anything.

Choosing **Ollama or LM Studio** keeps everything on your own machine — the passage never reaches the internet at all.

The API key you enter is stored in the plugin's settings inside your vault. If your vault syncs, the key syncs with it.

No account is required for the plugin itself, and there is no telemetry, no analytics and no ads.

---

## What's new in 1.0.1

**Android full-screen mode.** When opening any book on Android, the reader automatically enters full-screen mode to make full use of the screen and eliminate distractions.

**3-column progress footer.** The reading progress footer now features a balanced three-column layout:
- **Left**: Hours and minutes remaining to finish reading. Tap it to toggle between remaining time and pages left.
- **Center**: Real-time visible clock (`HH:mm`) alongside current page numbers.
- **Right**: Exact percentage of book progress (`%`).

**Kindle fonts.** Added the classic Kindle typefaces **Bookerly** and **Caecilia** to font choices, alongside Georgia, Lora, and Inter.

**Advanced typography and spacing controls.** Fine-tune your layout with dedicated sliders inside reading settings:
- Line height (spacing between lines)
- Paragraph spacing
- Word spacing
- Character / letter spacing

**Custom text margins.** Choose from 4 text column margin presets (**Narrow**, **Normal**, **Wide**, **Extra wide**) to comfortably fit your display.

**Code quality and compatibility.** 100% ESLint compliance, fixed deprecations for Obsidian 1.13+, and performance improvements.

## What's new in 1.0.0

**It loads where it used to refuse to.** On older Obsidian builds, Huawei tablets and some Windows installs the plugin failed with "Failed to load plugin" — the PDF engine expected a JavaScript feature those browser engines do not have. It is supplied now, so those devices get a working reader.

**Quotes can pile up in one book note.** The title dialog has an *Into the book's note* button, and the selection menu an *As text into the book's note* item — the second and third quote join the first instead of making new files.

**The link back to the book is worded by you.** Set your own label instead of "↪ to this spot in the book" in the settings.

**Fixes.** Tapping a highlight in the list now jumps to its place even on pages that have not been drawn yet; the selection bar no longer lands on empty space at the start of a paragraph or across a page break; on Android the top bar keeps clear of the clock, with a manual inset for skins that hide the status-bar height. What's new is also saved as a note in your vault.

**Ask an AI about a passage.** Select text and press ✨: a translation, a breakdown of the words that are actually hard, why the phrasing is what it is, and the etymology where it helps you remember. Use your own OpenRouter or OpenAI key, the Elton AI proxy, or a **local Ollama / LM Studio** — with a local model the passage never leaves your machine. Off until you set it up.

**Copy a passage as a quote, in one click.** The clipboard gets the quote, the book, the page and a link that opens the book at that exact paragraph — ready to paste into any note. The shape is a template you can change.

**Quotes link back to the book.** Every exported quote carries a link that opens the book at the paragraph it came from, and lands there whatever your font size or column count.

**Read by scrolling** instead of turning pages, if that suits you better.

**Footnotes work in FB2.** Tapping a note number takes you to the note, and a
"back to the text" pill takes you back where you were.

**Highlighting across paragraphs.** A selection spanning several paragraphs used
to be cut off at the end of the first one.

**Nested folders in the library.** Picking a folder now includes everything
inside it, and opens its subfolders as the next step down.

**Reading progress in the book note's properties**, so Bases can chart and sort
it. Off by default.

**Books no longer lose their ending.** The reader measured a book's width using
only its paragraphs, and cut the page flow off at that point — so a book whose
tail was a list, a code listing or a table simply stopped early. Measured in a
real browser: a book needing 119 spreads showed 5. Fixed, and the column stride
is now exact instead of drifting, which also removed the biggest cause of slow
loading in very long books.

**PDF text is no longer glued together.** Title pages came out as
`PRO ВластьRobert GREENEThe 48 laws ofPOWER`. Lines that wrapped back to the left
margin were being joined with nothing between them.

**No more phantom headings in PDFs.** Ordinary sentences were promoted to bold
headings on any page whose average type size was dragged down by small print.

**Separate look on each device.** Font size, theme, spacing and column count are
remembered separately for computer, tablet and phone — a comfortable size on a
tablet no longer makes the text enormous on a phone. Folders, templates and
reading progress stay shared.

**Comments reach your notes.** A comment written under a highlight was dropped
when that highlight became a note. It now travels with the quote.

**Works in a separate window.** Selecting text, page keys and the fullscreen
image viewer were all broken when the book was dragged out into its own window.

**Line width.** Cap lines at 60–90 characters so a maximised window stays
readable.

**Notes open beside the book** instead of replacing it, and can be filed in the
book's own folder.

**Typing a folder path no longer creates a folder per keystroke** on Windows.

**Book files behave like files.** Reveal the open book in the folder tree,
rename, move or delete it from the tab menu.

Full history: [`versions.json`](versions.json) and the release notes.

---

## Building from source

```bash
npm install
npm run build      # -> main.js
npx eslint src/    # community plugin rules
```

The plugin's own code is `src/main.js`. `main.js` at the repository root is the
build output — generated by esbuild, with pdf.js, epub.js, JSZip and localForage
bundled in. `npm run build` on a clean checkout reproduces the released file
byte for byte.

---

## 🙏 Credits
Kindle Reader is based on elton-reader by @swayinfo, which provided the original URL import foundation. This project has since been substantially rewritten and extended with new features.


## Licence

MIT — see [LICENSE](LICENSE).


---
# 📖 Kindle Reader em português

Leia livros EPUB, FB2 e PDF dentro do Obsidian — com destaques, comentários,
notas e progresso de leitura sincronizado com o seu vault.

*O Kindle Reader é baseado no Book Reader, de Elton, que forneceu a base original para importação por URL. Este projeto foi amplamente reescrito e expandido com novos recursos.*

**[English](#-kindle-reader) · Português**

Funciona em computadores e dispositivos móveis (Android / iOS).

[![Compre um café](https://img.shields.io/badge/Compre%20um%20café-Apoiar-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/bernardonogueira8)

> **Envie sugestões e problemas para o bot do Telegram [@book_in_obsidian_bot](https://t.me/book_in_obsidian_bot).**
> Encontrou um erro, sentiu falta de um recurso ou algo ficou estranho no celular? Envie uma
> mensagem comum. Não precisa de conta no GitHub nem de formulário. Todas as mensagens são lidas
> e ajudam a orientar as próximas versões.

![Book Reader](docs/promo-hero-en.jpg)

|  |  |
| --- | --- |
| ![Biblioteca](docs/promo-library-en.jpg) | ![Leitura](docs/promo-reading-en.jpg) |
| **Biblioteca** — capas, progresso e categorias para cada livro. | **Leitura** — páginas em duas colunas, com sua fonte, tamanho e tema. |
| ![Destaques](docs/promo-highlights-en.jpg) | ![IA](docs/promo-ai-en.jpg) |
| **Destaques → notas** — quatro cores, comentários e notas com a citação, o link para o livro e a página. | **Explique um trecho** — uma conversa com o título do livro enviado como contexto. |
| ![Celular](docs/promo-mobile-en.jpg) | ![Temas](docs/promo-themes-en.jpg) |
| **No celular** — um layout próprio, com gestos e «⋯». A posição e os destaques acompanham o vault. | **Quatro temas** — claro, sépia, escuro e e-ink, além do modo automático que segue o tema do Obsidian. |

---

## Recursos

**Leitura.** EPUB, FB2 e PDF. Layout paginado em uma ou duas colunas, como um
livro de verdade. Temas escuro, claro e sépia, além de um modo e-ink para leitores
Android. Ajuste a fonte (incluindo as clássicas do Kindle Bookerly e Caecilia), o tamanho,
espaçamentos detalhados (entre linhas, parágrafos, palavras e caracteres), 4 tamanhos de
margens, alinhamento e largura da linha. O sumário pode ser criado a partir dos marcadores
do PDF, dos títulos ou do sumário impresso do próprio livro. Pesquise o texto completo.

**Destaques e notas.** Quatro cores. Você pode adicionar comentários aos
destaques, que acompanham as citações nas notas. Transforme um destaque em nota
ou exporte todos os destaques de um livro de uma só vez, agrupados por capítulo e
com números de página.

**Progresso.** Salvo em arquivos no vault, junto aos livros, para sincronizar
com o serviço que você já usa (Obsidian Sync, iCloud, Google Drive, Remotely
Save…). A posição é vinculada ao parágrafo, então o celular e o computador
retomam a leitura no mesmo lugar, em qualquer tamanho de tela.

**Biblioteca.** Uma grade visual com capas, progresso e categorias para todos os
livros. Adicione livros arrastando os arquivos para a janela.

## Apoie o projeto

Se você gosta do **Kindle Reader** e quer apoiar o desenvolvimento contínuo de novos recursos e melhorias, considere me pagar um café:

[![Compre um café](https://img.shields.io/badge/Compre%20um%20café-Apoiar-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/bernardonogueira8)

---

## Instalação

O plugin está em análise para publicação no catálogo. Enquanto isso, instale-o
manualmente.

Baixe `main.js`, `manifest.json` e `styles.css` do
[último lançamento](https://github.com/bernardonogueira8/kindle-reader/releases/latest)
para `<vault>/.obsidian/plugins/kindle-reader/` e reinicie o Obsidian.

---

## Privacidade e uso da rede

**O leitor funciona totalmente offline.** Livros, progresso, destaques e notas
não saem do seu dispositivo — o mecanismo de PDF está incluído no plugin, que
não baixa da internet nem mesmo fontes ou workers.

Há apenas um recurso que faz uma solicitação de rede, e ele vem **desativado por
padrão**:

| Recurso | Serviço | Dados enviados | Padrão |
|---|---|---|---|
| Traduzir um trecho | Google Translate (`translate.googleapis.com`) | Somente o trecho selecionado | **Desativado** |
| Analisar trecho com IA | O serviço que **você** escolher — OpenRouter, OpenAI ou Ollama / LM Studio local | Somente o trecho selecionado | **Desativado** |

Ative esses recursos em *Configurações → Tradução*. Antes da ativação, cada um
informa isso na própria descrição. A análise com IA também exige que você escolha
um provedor e informe uma chave.

Com **Ollama ou LM Studio**, tudo permanece na sua máquina — o trecho não é
transmitido pela internet.

A chave de API fica nas configurações do plugin dentro do seu vault. Se o vault
for sincronizado, a chave também será sincronizada.

O plugin não exige uma conta e não tem telemetria, análise de uso ou anúncios.

---

## Novidades da versão 1.0.1

**Modo tela cheia no Android.** Ao abrir qualquer livro no Android, o leitor entra automaticamente em tela cheia para maximizar o espaço útil da tela e eliminar distrações.

**Rodapé de progresso em 3 colunas.** A barra inferior agora conta com um layout em três colunas informativas:
- **Esquerda**: Tempo restante estimado para terminar o livro (horas e minutos). Toque para alternar entre tempo e páginas restantes.
- **Centro**: Relógio visível em tempo real (`HH:mm`) junto com o indicador de páginas.
- **Direita**: Porcentagem exata de progresso do livro (`%`).

**Fontes clássicas do Kindle.** Adicionadas as renomadas fontes **Bookerly** e **Caecilia** às opções de seleção, junto com Georgia, Lora e Inter.

**Novos controles de espaçamento tipográfico.** Ajuste fino do texto diretamente no painel de configurações de leitura:
- Espaçamento entre linhas (altura da linha)
- Espaçamento entre parágrafos
- Espaçamento entre palavras
- Espaçamento entre caracteres

**Margens da coluna de texto.** Escolha entre 4 opções de largura de margem (**Estreita**, **Normal**, **Larga** e **Extra larga**) para a melhor experiência em celulares, tablets ou monitores.

**Qualidade e estabilidade.** 100% em conformidade com as diretrizes do Obsidian e regras do ESLint, com resolução de avisos de depreciação para o Obsidian 1.13+.

**Apoie o projeto.** Se você gosta de usar o Kindle Reader e quer apoiar o
desenvolvimento e a manutenção contínua, considere comprar um café em
buymeacoffee.com/bernardonogueira8 ☕

## Novidades da versão 1.0.0

**Funciona em dispositivos onde antes não carregava.** Em versões antigas do
Obsidian, tablets Huawei e algumas instalações do Windows, o plugin falhava com
“Failed to load plugin”: o mecanismo de PDF dependia de um recurso JavaScript
incompatível com esses navegadores. Esse recurso agora vem incluído, permitindo
que o leitor funcione nesses dispositivos.

**Reúna citações em uma nota do livro.** A janela de título tem o botão *Into the
book's note*, e o menu de seleção tem a opção *As text into the book's note* —
a segunda e a terceira citações são adicionadas à primeira, em vez de criar
novos arquivos.

**Personalize o texto do link de volta ao livro.** Defina nas configurações um
rótulo próprio em vez de “↪ to this spot in the book”.

**Correções.** Clicar em um destaque na lista agora leva ao trecho, mesmo em
páginas ainda não renderizadas. A barra de seleção não para mais em um espaço
vazio no início de um parágrafo ou entre páginas. No Android, a barra superior
não fica sobre o relógio; também é possível definir manualmente o espaçamento em
interfaces que não informam a altura da barra de status. As novidades também são
salvas como uma nota no vault.

**Converse com uma IA sobre um trecho.** Selecione o texto e pressione ✨ para
obter uma tradução, entender as palavras realmente difíceis, descobrir por que a
frase foi construída daquela forma e conhecer a etimologia quando ela ajudar na
memorização. Use sua chave do OpenRouter ou OpenAI, o proxy Elton AI ou uma
**instalação local do Ollama / LM Studio** — com um modelo local, o trecho não
sai do seu computador. O recurso fica desativado até ser configurado.

**Copie um trecho como citação com um clique.** A área de transferência recebe a
citação, o livro, a página e um link que abre o livro naquele parágrafo — pronto
para colar em qualquer nota. Você pode personalizar o formato com um modelo.

**As citações levam de volta ao livro.** Cada citação exportada inclui um link
para o parágrafo de origem e abre o trecho corretamente, independentemente do
tamanho da fonte ou do número de colunas.

**Leia rolando a página**, em vez de virar páginas, se preferir.

**Notas de rodapé funcionam em FB2.** Toque no número da nota para abri-la; o
botão “back to the text” leva você de volta ao ponto anterior.

**Destaque trechos em vários parágrafos.** Antes, a seleção era cortada no fim
do primeiro parágrafo.

**Pastas aninhadas na biblioteca.** Selecionar uma pasta agora inclui todo o seu
conteúdo e permite abrir as subpastas no próximo nível.

**O progresso de leitura fica nas propriedades da nota do livro**, para que o
Bases possa exibi-lo em gráficos e classificações. Desativado por padrão.

**Os livros não perdem mais o final.** A largura era calculada usando apenas os
parágrafos, e o fluxo das páginas era cortado nesse ponto. Assim, um livro que
terminava com uma lista, um trecho de código ou uma tabela parava antes da hora.
Em um navegador real, um livro que precisava de 119 páginas duplas mostrava
apenas 5. Isso foi corrigido, e o avanço entre colunas agora é exato, sem
acumular desvios — o que também eliminou a principal causa de lentidão em livros
muito longos.

**O texto dos PDFs não fica mais grudado.** Páginas de título apareciam com Linhas que voltavam para a margem
esquerda eram unidas sem espaço.

**Chega de títulos falsos nos PDFs.** Frases comuns eram transformadas em
cabeçalhos em negrito nas páginas cujo tamanho médio da fonte era reduzido por
textos em corpo pequeno.

**Personalize a aparência em cada dispositivo.** Tamanho da fonte, tema,
espaçamento e número de colunas são salvos separadamente para computador, tablet
e celular. Um tamanho confortável no tablet não deixa mais o texto enorme no
celular. Pastas, modelos e progresso de leitura continuam compartilhados.

**Os comentários acompanham as notas.** Antes, o comentário de um destaque era
perdido quando ele virava nota. Agora, ele acompanha a citação.

**Abra o livro em uma janela separada.** Selecionar texto, virar páginas pelo
teclado e visualizar imagens em tela cheia não funcionavam quando o livro era
arrastado para outra janela.

**Largura da linha.** Limite as linhas a 60–90 caracteres para manter a leitura
confortável em uma janela maximizada.

**Abra notas ao lado do livro**, em vez de substituir a leitura, e salve-as na
pasta do próprio livro.

**Digitar o caminho de uma pasta não cria mais uma pasta a cada tecla** no
Windows.

**Os arquivos dos livros funcionam como arquivos.** Localize o livro aberto na
árvore de pastas, renomeie, mova ou exclua pelo menu da aba.

Histórico completo: [`versions.json`](versions.json) e notas dos lançamentos.

---

## Compilar a partir do código-fonte

```bash
npm install
npm run build      # -> main.js
npx eslint src/    # regras para plugins da comunidade
```

O código do plugin fica em `src/main.js`. O `main.js` na raiz do repositório é
gerado pelo esbuild e inclui pdf.js, epub.js, JSZip e localForage. Executar
`npm run build` em uma cópia limpa reproduz o arquivo publicado byte a byte.

---

## 🙏 Créditos

O Kindle Reader é baseado no elton-reader, de @swayinfo, que forneceu a base
original para a importação por URL. Desde então, este projeto foi amplamente
reescrito e expandido com novos recursos.

---

## Licença

MIT — consulte [LICENSE](LICENSE).
