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
