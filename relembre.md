# 1. Faz suas mudanças e commita
git add .
git commit -m "minhas melhorias"

# 2. Sobe a versão automaticamente (ex: de 1.0.3 para 1.0.4)
npm version patch

# 3. Manda pro GitHub (a GitHub Action compila e cria a release sozinha)
git push
git push --tags
