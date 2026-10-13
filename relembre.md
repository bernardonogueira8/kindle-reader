#### 1. Faz suas mudanças e commita
git add .

git commit -m "minhas melhorias"

#### 2.1 Sobe a versão automaticamente (ex: de 1.0.1 para 1.0.2)
npm version patch

#### 2.2 Sobe a versão automaticamente (ex: de 1.0.X para 1.1.0)
npm version minor

#### 2.3 Sobe a versão automaticamente (ex: de 1.X.X para 2.0.0)
npm version major

#### 3. Manda pro GitHub (a GitHub Action compila e cria a release sozinha)
git push

git push --tags

## Lista de melhorias pendentes:
1. **Unificação de Lógica entre ReaderView.ts e ReaderModal.ts** (Concluído)
2. **Modularização de main.ts** (Concluído)
3. **Dicionário / Definições Rápidas** (Concluído)
4. **Formatação de Destaques em Callouts Modernos** (Concluído)
5. **Gestos Táteis Naturais** (Concluído)
6. **Prevenção de Tela Apagando (Screen Wake Lock API)** (Concluído)
7. **Tempo Restante no Capítulo (*Time left in chapter*)** (Concluído)
8. **Marcador de Página Rápido (*Bookmarks*)** (Concluído)
9. **Metadados em Frontmatter (Compatível com Dataview)** (Concluído)
10. **Painel de Insights / Heatmap de Leitura** (Concluído)

11. Toda vez que abrir a tela inicial da biblioteca , deve pesquisar novos livros e tem botao para procurar novos livros na pasta
12. 
plugin:kindle-reader:71348 Kindle Reader: could not register .pdf, use right-click → Open in Kindle Reader Error: Attempting to register an existing file extension "pdf"
    at t.registerExtensions (app.js:1:2815365)
    at t.registerExtensions (app.js:1:2948326)
    at Nw.onload (plugin:kindle-reader:71348:54311)
app.js:1 Failed to open view TypeError: Cannot read properties of null (reading 'setText')
    at t.load (app.js:1:1238719)
    at wr.<anonymous> (app.js:1:1233991)
    at app.js:1:254188
    at Object.next (app.js:1:254293)
    at app.js:1:253209
    at new Promise (<anonymous>)
    at y (app.js:1:252954)
    at t.open (app.js:1:1233854)
    at t.<anonymous> (app.js:1:1573562)
    at app.js:1:254188