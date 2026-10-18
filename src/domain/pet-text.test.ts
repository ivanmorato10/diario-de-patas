import { describe, expect, it } from "vitest";
import { petText } from "./pet-text";

describe("petText", () => {
  it("troca cachorro pelo nome", () => {
    expect(petText("O cachorro cochilando.", "Pepe")).toBe("Pepe cochilando.");
    expect(petText("Cachorro e um brinquedo visíveis na foto.", "Pepe")).toBe("Pepe e um brinquedo visíveis na foto.");
    expect(petText("Você e seu cachorro (ou alguém da família) na mesma foto.", "Pepe")).toBe("Você e Pepe (ou alguém da família) na mesma foto.");
    expect(petText("uma foto em que dê para ver bem o seu cachorro.", "Pepe")).toBe("uma foto em que dê para ver bem Pepe.");
    expect(petText("Uma pessoa fazendo carinho no cachorro.", "Pepe")).toBe("Uma pessoa fazendo carinho em Pepe.");
    expect(petText("Um treino rápido, no ritmo do seu cachorro.", "Pepe")).toBe("Um treino rápido, no ritmo de Pepe.");
    expect(petText("Retrato com o cachorro claramente visível.", "Pepe")).toBe("Retrato com Pepe claramente visível.");
  });
  it("só personaliza o cachorro da pessoa: outro cachorro continua genérico", () => {
    expect(petText("Um encontro tranquilo com outro cachorro.", "Abu")).toBe("Um encontro tranquilo com outro cachorro.");
    expect(petText("O cachorro perto de outro cachorro.", "Abu")).toBe("Abu perto de outro cachorro.");
    expect(petText("Brincando com um cachorro amigo.", "Abu")).toBe("Brincando com um cachorro amigo.");
    expect(petText("O cachorro e qualquer cachorro da rua.", "Abu")).toBe("Abu e qualquer cachorro da rua.");
    expect(petText("Uma pessoa fazendo carinho no cachorro.", "Abu")).toBe("Uma pessoa fazendo carinho em Abu.");
    expect(petText("Você e seu cachorro na mesma foto.", "Abu")).toBe("Você e Abu na mesma foto.");
  });
  it("mantém o plural e textos sem nome", () => {
    expect(petText("Dois ou mais cachorros enquadrados.", "Pepe")).toBe("Dois ou mais cachorros enquadrados.");
    expect(petText("O cachorro na cozinha.", null)).toBe("O cachorro na cozinha.");
  });
});
