# Pacotes recebidos — triagem de 2026-09-23

Os ZIPs originais permanecem intactos. Esta triagem separa material realmente integrado, candidatos a adaptação manual e pacotes que não servem ao teste 3/4 atual. A possibilidade de ajustar paleta, contraste e efeitos não transforma um asset em arte final aprovada.

| Arquivo | Uso no projeto | Situação |
| --- | --- | --- |
| `duelyst_animated_sprites.zip` | Sprites e `SpriteFrames` de `f1_warblade`, `neutral_beastphasehound` e `boss_borealjuggernaut`, mais ícone `artifact_f5_twinfang`, copiados para `game/addons/duelyst_animated_sprites/`. | Proxies temporários de caçador, Ravenwolf e Bloodfang; licença CC0 1.0 incluída. A identidade e o encaixe visual ainda exigem arte autoral e revisão de animação/hitbox. |
| `Forest_Isometric_Pack_Free.zip` | Três sprites de árvores/rocha usados em `game/Art/ForestFree/`. | README declara CC0 1.0. Um tile de chão foi testado no plano 3D e rejeitado: parecia uma ilha elevada sem continuidade; o teste foi removido. |
| `2d_isometric_Cave_tiles.zip` | Referência potencial de terreno/caverna. | Candidato condicionado; README escreve “CC BY 0.0”, nomenclatura ambígua. Não importado. |
| `MorbidEmber_pixel-RPG-starter-pack_v1.1-2.zip` | Oito ícones de itens, baús e pontos de interação importados para `game/Art/MorbidEmber/`. | ZIP inclui `MIT License.txt` (copyright 2026 Morbidember), copiada para `game/Art/MorbidEmber/LICENSE.txt`; uso permitido com aviso preservado. Arte 2D ainda é provisória no mundo 3D. |
| `Melee_Pack-2.zip` | Efeitos e armas 2D pequenos para estudo de feedback de combate. | Candidato; licença própria permite modificar e usar em jogos, mas veda redistribuição separada. Não importado. |
| `Legacy-Fantasy_-_High_Forest_2.0.zip` | Cenário/figuras de perspectiva lateral. | Não integrado: perspectiva incompatível com o teste; nenhum arquivo de licença no ZIP. |
| `Flags_16x16_Icon_nnekart.zip` | Ícones minúsculos de bandeira. | Não integrado: sem necessidade atual e sem licença no ZIP. |
| `Verdant00_FreeSample.zip` | Tiles de vegetação. | Excluído: a própria licença identifica tiles gerados programaticamente, contrariando a exigência atual de arte não procedural. |
| `misc_2.5d.zip` | Exemplo de técnica 2.5D. | Referência técnica somente; não importar uma demonstração inteira para o jogo. |
| `AfterImage2D.zip` | Rastro 2D. | Não integrado: efeito 2D não atende diretamente aos atores `AnimatedSprite3D`; implementar apenas quando houver direção de VFX. |
| `awesome-custom-cursor-2.0.2.zip` | Cursor e interface. | Reservado para fase de HUD; sem necessidade na sala de teste. |
| `breakable_2d_sprites_v1.0.0-3.zip` | Quebra de sprites 2D. | Não integrado: mecânica/arte de destruição ainda não definida. |
| `godotx_health_bar.zip` | Barra de vida 2D pronta. | MIT; examinado. Não importado porque seu acompanhamento de mundo é para `Node2D`, enquanto criaturas atuais são `CharacterBody3D`. O feedback 3D local usa `Label3D` discreto. |
| `godotx_label_up-2.zip` | Rótulos flutuantes 2D. | MIT; examinado. Não importado porque exige ponte de projeção/CanvasLayer para cenas 3D; o feedback 3D local evita addon global nesta etapa. |
| `health-system-v1.0.0.zip` | Sistema de vida pronto. | Não integrado: o jogo já possui `Health.cs` e testes próprios. |
| `saltmire-hitbox-lite-assetstore.zip` | Hitbox pronta. | Não integrado: o jogo já possui `Hurtbox.cs` e hitbox de melee. |
| `sprite_forge_v1.1.3_fixed.zip` | Ferramenta de sprites. | Não integrado: não há etapa de edição de sprites que a requeira agora. |
| `sprite_staticbody_builder.zip` | Geração de corpo físico a partir de sprite. | Não integrado: conflita com controle manual da forma visual/física; colliders técnicos atuais já existem. |
| `Starter-Kit-City-Builder-main.zip` | Peças e projeto de city builder 3D. | Não integrado: estilo e fluxo de geração genéricos não servem à direção autoral de ASHEN TRAIL. |

O ZIP Duelyst tem SHA-256 `E7C5BE09C378FAD0F24227B3E1D53A587636E4E88167A2D16E9A96CD68EA3AD5`. O antigo `boss_chaosknight.tres/.png` continua no projeto, mas não é mais usado pelo caçador. Os ZIPs originais continuam intactos; cada importação foi seletiva, sem admissão em massa.
