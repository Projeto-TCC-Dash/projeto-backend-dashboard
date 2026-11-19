# Kit de Arquivos de Teste — Demonstração Banca TCC

Todos os arquivos abaixo pertencem a **um único usuário** e usam datas de **novembro/2026**.

## 1. Contas sugeridas para criar em `/accounts`

| Nome da Conta | Tipo | Instituição (opcional) | Arquivo para importar |
| :--- | :--- | :--- | :--- |
| **Conta Principal** | `CHECKING` (Conta Corrente) | Banco Itaú | `01-conta-corrente-principal.ofx` |
| **Cartão Nubank** | `CREDIT_CARD` (Cartão de Crédito) | Nubank | `02-cartao-credito.csv` |
| **Corretora XP** | `INVESTMENT` (Investimentos) | XP Investimentos | `03-investimentos-corretora.csv` |

## 2. O que cada arquivo testa

1. **`01-conta-corrente-principal.ofx`** (7 lançamentos)
   - Parser nativo **OFX** (`<STMTTRN>`, `<FITID>`, `<MEMO>`, `<TRNAMT>`).
   - **Deduplicação**: ao importar o mesmo arquivo uma segunda vez, os 7 `FITID`s são ignorados.
   - **Segregação de Fatura**: contém `PAGAMENTO FATURA CARTAO NUBANK` (`-2.150,00`).
   - **Transferência para Investimentos**: contém `TED ENVIADA CORRETORA INVESTIMENTOS` (`-1.500,00`).

2. **`02-cartao-credito.csv`** (7 lançamentos)
   - Parser **CSV** (`;`, UTF-8, `DD/MM/YYYY`).
   - **Categorização por IA + Edição Manual**: inclui `PAGTO PIX MERCADO LIVRE 9942` (`-220,00`).
   - **Despesa Dedutível no IR**: inclui `CLINICA MEDICA VIDA PLENA LTDA` (`-420,00`) para casar com o recibo PDF.

3. **`03-investimentos-corretora.csv`** (4 lançamentos)
   - Aportes (`-1.000,00` Tesouro Selic, `-500,00` FII) e proventos (`+85,40` dividendos, `+42,10` JCP).

4. **`04-recibo-medico-fiscal.pdf`**
   - Upload na aba **Fiscal** (`/fiscal`) para testar o **OCR com Gemini Vision**:
     - **Prestador**: Clínica Médica Vida Plena Ltda
     - **CNPJ**: `12.345.678/0001-95`
     - **Valor**: `R$ 420,00`
     - **Data**: `14/11/2026`
