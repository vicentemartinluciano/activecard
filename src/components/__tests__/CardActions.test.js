import React from 'react';
import { act, create } from 'react-test-renderer';
import CardActions from '../CardActions';
jest.mock('react-native', () => ({ Platform: { OS: 'android', select: (v) => v.default }, StyleSheet: { create: (s) => s }, Text: 'text', View: 'view' }));
jest.mock('../ui', () => ({ Button: (props) => require('react').createElement('button', props) }));
jest.mock('../ActionSheet', () => (props) => props.visible ? require('react').createElement('sheet', props, props.children) : null);
jest.mock('../CardMoveSheet', () => () => null);
let screen;
afterEach(async () => { await act(async () => screen?.unmount()); });

test('el menú tiene solo mover, suspender y eliminar; cancelar no elimina', async () => {
  const remove = jest.fn();
  await act(async () => { screen = create(<CardActions card={{ id: 1, front: 'Pregunta' }} onClose={() => {}} onDelete={remove} />); });
  const menu = screen.root.findByType('sheet');
  expect(menu.props.options.map((option) => option.label)).toEqual(['Mover a otro mazo', 'Suspender del estudio', 'Eliminar tarjeta']);
  await act(async () => menu.props.options[2].onPress());
  expect(JSON.stringify(screen.toJSON())).toContain('Pregunta');
  await act(async () => screen.root.findAllByType('button').find((button) => button.props.label === 'Cancelar').props.onPress());
  expect(remove).not.toHaveBeenCalled();
});

test('fallar al eliminar mantiene la confirmación y reintentar no duplica envíos', async () => {
  let finish;
  const remove = jest.fn().mockRejectedValueOnce(new Error('Disco ocupado')).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => { screen = create(<CardActions card={{ id: 1, front: 'Pregunta' }} onClose={() => {}} onDelete={remove} />); });
  await act(async () => screen.root.findByType('sheet').props.options[2].onPress());
  const submit = () => screen.root.findAllByType('button').find((button) => button.props.kind === 'danger').props.onPress;
  await act(async () => submit()());
  expect(JSON.stringify(screen.toJSON())).toContain('Disco ocupado');
  const retry = submit();
  await act(async () => { retry(); retry(); });
  expect(remove).toHaveBeenCalledTimes(2);
  await act(async () => finish());
  expect(screen.root.findAllByType('sheet')).toHaveLength(1);
});
