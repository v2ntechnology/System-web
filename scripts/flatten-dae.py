"""Resolve <instance_node> num COLLADA do SketchUp.

O COLLADA2GLTF 2.1.5 ignora nos instanciados de <library_nodes>, e o SketchUp
exporta todo componente assim: o resultado sai com camera e sem geometria. Este
script copia o no alvo para o lugar da instancia, recursivamente, e grava um
.dae equivalente que o conversor entende.

A travessia so desce em <node>: <instance_node> nunca aparece dentro de malha,
e descer na arvore inteira faria o contador de profundidade medir o XML em vez
da cadeia de instanciacao.

Uso: py flatten-dae.py <entrada.dae> <saida.dae>
"""

import sys
import xml.etree.ElementTree as ET

NS = 'http://www.collada.org/2005/11/COLLADASchema'
ET.register_namespace('', NS)


def tag(name):
    return f'{{{NS}}}{name}'


src, dst = sys.argv[1], sys.argv[2]

tree = ET.parse(src)
root = tree.getroot()

library = {}
for lib in root.iter(tag('library_nodes')):
    for node in lib.iter(tag('node')):
        node_id = node.get('id')
        if node_id:
            library[node_id] = node

print(f'nos na biblioteca: {len(library)}')

expanded = 0
missing = set()


def expand(parent, depth):
    """Troca cada <instance_node> filho pelo no que ele referencia."""
    global expanded
    if depth > 24:
        raise SystemExit('ERRO: cadeia de instance_node acima de 24, provavel ciclo')

    for index, child in enumerate(list(parent)):
        if child.tag == tag('instance_node'):
            url = (child.get('url') or '').lstrip('#')
            target = library.get(url)
            if target is None:
                missing.add(url)
                continue
            copy = ET.fromstring(ET.tostring(target))
            copy.attrib.pop('id', None)
            parent.remove(child)
            parent.insert(index, copy)
            expanded += 1
            expand(copy, depth + 1)
        elif child.tag == tag('node'):
            expand(child, depth)


for scene in root.iter(tag('visual_scene')):
    expand(scene, 0)

if missing:
    print(f'AVISO: {len(missing)} instance_node sem alvo: {sorted(missing)[:5]}')

print(f'instancias resolvidas: {expanded}')
tree.write(dst, encoding='UTF-8', xml_declaration=True)
