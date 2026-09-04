function normalize(data) {
    if (!data || !data.formulario_final) return data;
    const form = data.formulario_final;

    // Impede o preenchimento de cônjuge se ele extrair N/A, NÃO INFORMADO, etc
    const nomeConjugeRaw = form.relacao_juridica_conjuge_ou_companheiro?.nome_completo || "";
    const isConjugeValido = nomeConjugeRaw && !nomeConjugeRaw.match(/N\/A|NÃO/i);

    return {
        data_apresentacao_1: form.apresentacao?.data_1 || new Date().toLocaleDateString("pt-BR"),
        data_apresentacao_2: form.apresentacao?.data_2 || "",
        data_apresentacao_3: form.apresentacao?.data_3 || "",
        
        numero_contrato: form.dados_do_contrato?.numero_originario || "",
        tipo_contrato: form.dados_do_contrato?.tipo_de_contrato || "",
        data_contrato: form.dados_do_contrato?.datas_dos_contratos || "",
        numero_contrato_completo: form.dados_do_contrato?.numero_do_contrato_completo || "",

        nome_adquirente: form.relacao_juridica_adquirente?.nome_completo || "",
        nac_adquirente: form.relacao_juridica_adquirente?.nacionalidade || "",
        nasc_adquirente: form.relacao_juridica_adquirente?.data_nascimento || "",
        prof_adquirente: form.relacao_juridica_adquirente?.profissao || "",
        cpf_adquirente: form.relacao_juridica_adquirente?.cpf || "",
        doc_adquirente: form.relacao_juridica_adquirente?.documento_identidade || "",
        est_civil_adquirente: form.relacao_juridica_adquirente?.estado_civil_historico || "",
        email_adquirente: form.relacao_juridica_adquirente?.email || "",
        telefone_adquirente: form.relacao_juridica_adquirente?.telefone || "",

        papel_conjuge: form.relacao_juridica_conjuge_ou_companheiro?.papel || "",
        nome_conjuge: isConjugeValido ? nomeConjugeRaw : "",
        regime_casamento: isConjugeValido ? form.relacao_juridica_conjuge_ou_companheiro?.regime_casamento || "" : "",
        nac_conjuge: isConjugeValido ? form.relacao_juridica_conjuge_ou_companheiro?.nacionalidade || "" : "",
        nasc_conjuge: isConjugeValido ? form.relacao_juridica_conjuge_ou_companheiro?.data_nascimento || "" : "",
        prof_conjuge: isConjugeValido ? form.relacao_juridica_conjuge_ou_companheiro?.profissao || "" : "",
        cpf_conjuge: isConjugeValido ? form.relacao_juridica_conjuge_ou_companheiro?.cpf || "" : "",
        doc_conjuge: isConjugeValido ? form.relacao_juridica_conjuge_ou_companheiro?.documento_identidade || "" : "",
        est_civil_conjuge: isConjugeValido ? "CASADA" : "",
        email_conjuge: "",
        telefone_conjuge: "",

        tipo_imovel: form.imovel?.tipo || "",
        endereco_imovel: form.imovel?.endereco_logradouro || "",
        conjunto_hab: form.imovel?.conjunto_habitacional || "",
        cep_imovel: form.imovel?.cep || "",
        lote: form.imovel?.lote || "",
        quadra: form.imovel?.quadra || "",
        bairro: form.imovel?.bairro || "",
        cidade_uf: form.imovel?.cidade_uf || "",
        preco_imovel: form.dados_do_contrato?.valor_declarado_e_data || "",
        indice_cadastral: form.imovel?.indice_cadastral_iptu || "",
        matricula: form.imovel?.registro_matricula || "",
        livro: form.imovel?.registro_livro || "",
        cartorio: form.imovel?.cartorio_nome || "",
        num_arquivos: form.imovel?.numero_total_paginas_analisadas || "",
        
        observacoes_contrato: form.observacoes_e_onus?.texto || "",
        data_relato: form.apresentacao?.data_2 || form.apresentacao?.data_1 || new Date().toLocaleDateString("pt-BR"),
        breve_relato: form.breve_relato || "",
        nome_analista: form.nome_analista_ia || "IA - PIPELINE COHAB"
    };
}

module.exports = { normalize };